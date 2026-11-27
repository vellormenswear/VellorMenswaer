// Called exclusively inside the caller's existing transaction after its authorization and validation.
export async function createSupplierAccount(c,{name,mail,hashed,phone,business,document,address,pix}){
 const account=await c.query("INSERT INTO users(full_name,email,password_hash,phone,role) VALUES($1,$2,$3,$4,'supplier') RETURNING id",[name,mail,hashed,phone]);
 const user_id=account.rows[0].id;
 const supplier=await c.query('INSERT INTO suppliers(user_id,business_name,document_number,address_text) VALUES($1,$2,$3,$4) RETURNING id',[user_id,business,document,address]);
 const supplier_id=supplier.rows[0].id;
 await c.query('INSERT INTO supplier_pix_accounts(supplier_id,pix_type,pix_key,holder_name) VALUES($1,$2,$3,$4)',[supplier_id,pix.pix_type,pix.pix_key,pix.holder_name]);
 return {user_id,supplier_id};
}
