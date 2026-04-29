const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// GET /api/reports/summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const [totals, byStatus, byPriority, topIssues, byCategory, resolution] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int                                                  AS total_notes,
          COUNT(*) FILTER (WHERE status = 'Open')::int                  AS open_notes,
          COUNT(*) FILTER (WHERE status = 'In Progress')::int           AS in_progress_notes,
          COUNT(*) FILTER (WHERE status = 'Resolved')::int              AS resolved_notes,
          (SELECT COUNT(*)::int FROM clients)                           AS total_clients,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'Resolved')::numeric
            / NULLIF(COUNT(*), 0) * 100, 1
          )                                                              AS resolution_rate
        FROM notes
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM notes GROUP BY status
      `),
      pool.query(`
        SELECT priority, COUNT(*)::int AS count
        FROM notes GROUP BY priority
      `),
      pool.query(`
        SELECT n.title, n.counter, n.status, n.priority, cat.name AS category
        FROM notes n
        LEFT JOIN categories cat ON cat.id = n.category_id
        ORDER BY n.counter DESC LIMIT 10
      `),
      pool.query(`
        SELECT cat.name, COUNT(n.id)::int AS count, SUM(n.counter)::int AS total_occurrences
        FROM categories cat
        LEFT JOIN notes n ON n.category_id = cat.id
        WHERE cat.parent_id IS NULL
        GROUP BY cat.id, cat.name
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT
          u.name AS agent_name,
          COUNT(n.id)::int                                           AS total_notes,
          COUNT(n.id) FILTER (WHERE n.status = 'Resolved')::int     AS resolved,
          COUNT(n.id) FILTER (WHERE n.status = 'Open')::int         AS open,
          ROUND(
            COUNT(n.id) FILTER (WHERE n.status = 'Resolved')::numeric
            / NULLIF(COUNT(n.id), 0) * 100, 1
          )                                                          AS resolution_rate,
          ROUND(AVG(
            EXTRACT(EPOCH FROM (n.resolved_at - n.created_at)) / 3600
          ) FILTER (WHERE n.resolved_at IS NOT NULL), 1)            AS avg_hours_to_resolve
        FROM users u
        LEFT JOIN notes n ON n.agent_id = u.id
        WHERE u.role = 'agent'
        GROUP BY u.id, u.name
        ORDER BY total_notes DESC
      `),
    ]);

    res.json({
      totals: totals.rows[0],
      by_status: byStatus.rows,
      by_priority: byPriority.rows,
      top_issues: topIssues.rows,
      by_category: byCategory.rows,
      agent_performance: resolution.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/trend  (notes over time)
router.get('/trend', authenticate, async (req, res) => {
  const { period = 'monthly', months = 6 } = req.query;
  try {
    const groupBy = period === 'weekly' ? 'week' : 'month';
    const result = await pool.query(`
      SELECT
        DATE_TRUNC($1, created_at) AS period,
        COUNT(*)::int              AS total,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'Open')::int     AS open
      FROM notes
      WHERE created_at >= NOW() - ($2 || ' months')::interval
      GROUP BY period
      ORDER BY period
    `, [groupBy, months]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/export/excel
router.get('/export/excel', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const notes = await pool.query(`
      SELECT n.id, n.title, n.description, n.priority, n.status, n.counter,
             cl.name AS client, u.name AS agent, cat.name AS category,
             n.created_at, n.updated_at
      FROM notes n
      LEFT JOIN clients cl ON cl.id = n.client_id
      LEFT JOIN users u ON u.id = n.agent_id
      LEFT JOIN categories cat ON cat.id = n.category_id
      ORDER BY n.created_at DESC
    `);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'IssueTrack CRM';
    wb.created = new Date();

    // --- Notes Sheet ---
    const ws = wb.addWorksheet('Notes', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'ID',          key: 'id',          width: 8  },
      { header: 'Title',       key: 'title',       width: 40 },
      { header: 'Client',      key: 'client',      width: 25 },
      { header: 'Category',    key: 'category',    width: 20 },
      { header: 'Agent',       key: 'agent',       width: 20 },
      { header: 'Priority',    key: 'priority',    width: 12 },
      { header: 'Status',      key: 'status',      width: 14 },
      { header: 'Counter',     key: 'counter',     width: 10 },
      { header: 'Created',     key: 'created_at',  width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2535' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFE8ECF4' } };

    const priorityColors = { High: 'FFEF4444', Medium: 'FFF59E0B', Low: 'FF6B7280' };
    const statusColors   = { Open: 'FF4F8EF7', 'In Progress': 'FFF59E0B', Resolved: 'FF22C55E' };

    notes.rows.forEach(n => {
      const row = ws.addRow({
        ...n,
        created_at: new Date(n.created_at).toLocaleDateString(),
      });
      row.getCell('priority').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: priorityColors[n.priority] || 'FF6B7280' } };
      row.getCell('status').fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[n.status] || 'FF6B7280' } };
    });

    // --- Summary Sheet ---
    const ws2 = wb.addWorksheet('Summary');
    const summary = await pool.query(`
      SELECT
        COUNT(*)::int                                           AS total_notes,
        COUNT(*) FILTER (WHERE status='Resolved')::int         AS resolved,
        COUNT(*) FILTER (WHERE status='Open')::int             AS open,
        SUM(counter)::int                                      AS total_occurrences
      FROM notes
    `);
    ws2.addRow(['Metric', 'Value']);
    ws2.getRow(1).font = { bold: true };
    Object.entries(summary.rows[0]).forEach(([k, v]) => {
      ws2.addRow([k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), v]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="issuetrack_export_${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/export/pdf
router.get('/export/pdf', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const [summary, topIssues, agents] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='Resolved')::int AS resolved, COUNT(*) FILTER (WHERE status='Open')::int AS open FROM notes`),
      pool.query(`SELECT title, counter, status FROM notes ORDER BY counter DESC LIMIT 10`),
      pool.query(`SELECT u.name, COUNT(n.id)::int AS notes FROM users u LEFT JOIN notes n ON n.agent_id=u.id WHERE u.role='agent' GROUP BY u.id,u.name ORDER BY notes DESC`),
    ]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="issuetrack_report_${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#0f1117');
    doc.fillColor('#4f8ef7').fontSize(24).font('Helvetica-Bold').text('IssueTrack CRM', 50, 22);
    doc.fillColor('#8892a4').fontSize(12).font('Helvetica').text(`Report generated: ${new Date().toLocaleDateString()}`, 50, 50);
    doc.moveDown(3);

    // Summary section
    doc.fillColor('#e8ecf4').fontSize(16).font('Helvetica-Bold').text('Executive Summary');
    doc.moveDown(0.5);
    const s = summary.rows[0];
    const rate = s.total ? Math.round(s.resolved / s.total * 100) : 0;
    [
      ['Total Issues', s.total],
      ['Open Issues', s.open],
      ['Resolved Issues', s.resolved],
      ['Resolution Rate', `${rate}%`],
    ].forEach(([label, val]) => {
      doc.fillColor('#8892a4').fontSize(11).font('Helvetica').text(label + ':  ', { continued: true });
      doc.fillColor('#e8ecf4').font('Helvetica-Bold').text(String(val));
    });
    doc.moveDown();

    // Top issues
    doc.fillColor('#e8ecf4').fontSize(16).font('Helvetica-Bold').text('Top Recurring Issues');
    doc.moveDown(0.5);
    topIssues.rows.forEach((n, i) => {
      doc.fillColor('#8892a4').fontSize(10).font('Helvetica')
        .text(`${i + 1}. `, { continued: true });
      doc.fillColor('#e8ecf4').text(`${n.title}`, { continued: true });
      doc.fillColor('#4f8ef7').text(`  ×${n.counter}`);
    });
    doc.moveDown();

    // Agent performance
    doc.fillColor('#e8ecf4').fontSize(16).font('Helvetica-Bold').text('Agent Performance');
    doc.moveDown(0.5);
    agents.rows.forEach(a => {
      doc.fillColor('#8892a4').fontSize(10).font('Helvetica')
        .text(`${a.name}: `, { continued: true });
      doc.fillColor('#22c55e').text(`${a.notes} notes`);
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
