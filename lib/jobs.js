/* Shared job side effects: auto invoice numbers and keeping the source lead in sync. */
export async function afterJobSave({ env }, job) {
  const db = env.DB;
  if (!job.invoice_no) {
    job = await db
      .prepare("UPDATE jobs SET invoice_no = printf('CC-%s-%04d', substr(job_date, 1, 4), id) WHERE id = ? RETURNING *")
      .bind(job.id)
      .first();
  }
  if (job.paid && !job.paid_date) {
    job = await db.prepare("UPDATE jobs SET paid_date = date('now') WHERE id = ? RETURNING *").bind(job.id).first();
  }
  if (job.lead_id && job.status !== 'cancelled') {
    await db.prepare("UPDATE leads SET status = 'booked' WHERE id = ?").bind(job.lead_id).run();
  }
  return job;
}
