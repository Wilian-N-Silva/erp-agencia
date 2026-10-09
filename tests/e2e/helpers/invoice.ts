import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { isolatedE2eDatabaseUrl } from "./isolated-database";

export async function createInvoiceDownloadFixture() {
  const db = new Client({ connectionString: isolatedE2eDatabaseUrl() });
  await db.connect();
  const employee = randomUUID(), invoice = randomUUID(), file = randomUUID(), document = randomUUID();
  const name = `HML-NF-${employee}`, filename = `${name}.pdf`;
  const body = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
  if (process.env.STORAGE_PROVIDER !== "local" || !process.env.LOCAL_UPLOAD_DIR) {
    await db.end();
    throw new Error("Invoice fixture requires isolated local file storage.");
  }
  try {
    const { rows: [template] } = await db.query('select u.id,u.organization_id,e.area_id,e.position_id from "user" u join employees e on e.user_id=u.id where u.email=$1', ['pj.exemplo@formula.local']);
    if (!template) throw new Error("Run the fictitious demo seed in the isolated E2E database first.");
    const key = `${template.organization_id}/e2e-invoices/${file}.pdf`;
    const destination = path.resolve(process.env.LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body, { flag: 'wx' });
    await db.query('BEGIN');
    await db.query("insert into employees (id,organization_id,registration_number,full_name,area_id,position_id,employment_type,start_date,current_compensation) values ($1,$2,$3,$3,$4,$5,'pj','2026-01-01',100)", [employee,template.organization_id,name,template.area_id,template.position_id]);
    await db.query("insert into files (id,organization_id,owner_employee_id,storage_provider,storage_key,original_name,mime_type,extension,byte_size,checksum,uploaded_by_user_id) values ($1,$2,$3,'local',$4,$5,'application/pdf','pdf',$6,$7,$8)", [file,template.organization_id,employee,key,filename,body.length,createHash('sha256').update(body).digest('hex'),template.id]);
    await db.query("insert into invoice_requests (id,organization_id,employee_id,competence,due_date,expected_amount,issued_amount,suggested_description,status,file_id,created_by_user_id) values ($1,$2,$3,'2026-10','2026-10-28',100,100,'Fictitious download fixture','submitted',$4,$5)", [invoice,template.organization_id,employee,file,template.id]);
    await db.query("insert into documents (id,organization_id,owner_type,owner_id,document_type,file_id,uploaded_by_user_id) values ($1,$2,'invoice_request',$3,'invoice',$4,$5)", [document,template.organization_id,invoice,file,template.id]);
    await db.query('COMMIT');
    return { id: document, name, filename };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { await db.end(); }
}
