// Views (security-invoker): computed on the caller's snapshot. Shared by demo and Supabase builds.
const VIEWS = {
    kpi(s, month){
      return s.targets.filter(t => t.month === month).map(t => {
        const u = s.users.find(x => x.id === t.rep_id) || {};
        const cashSale = s.invoices.filter(i => i.rep_id===t.rep_id && i.status==='posted' && monthKey(i.synced_at)===month).reduce((a,i)=>a+i.paid_at_sale,0);
        const coll = s.colls.filter(c => c.rep_id===t.rep_id && monthKey(c.collected_at)===month).reduce((a,c)=>a+c.amount,0);
        const cartons = s.invoices.filter(i => i.rep_id===t.rep_id && i.status==='posted' && monthKey(i.synced_at)===month).reduce((a,i)=>a+i.items.reduce((b,x)=>b+x.qty,0),0);
        const total = r2(cashSale + coll);
        return { rep_id:t.rep_id, name:u.full_name, target:t.collection_target, collected:total, pct:t.collection_target ? Math.round(1000*total/t.collection_target)/10 : 0, cartons, carton_target:t.carton_target };
      });
    },
    lowStock(s){ return s.wh.filter(w => w.qty <= w.reorder).map(w => ({ ...w, product:s.products.find(p => p.id===w.product_id) })); },
    outstanding(s){
      return s.customers.map(c => {
        const inv = s.invoices.filter(i => i.customer_id===c.id && i.status==='posted' && i.balance_due>0);
        const op = s.open.filter(o => o.customer_id===c.id && o.balance_due>0);
        const out = r2(inv.reduce((a,i)=>a+i.balance_due,0) + op.reduce((a,o)=>a+o.balance_due,0));
        const dues = [...inv, ...op].map(x => x.due_date).filter(Boolean).sort();
        return { customer:c, outstanding:out, oldest_due:dues[0]||null };
      }).filter(x => x.outstanding > 0);
    },
    reconcile(s){
      const bad = [];
      s.van.forEach(v => { const sum = s.moves.filter(m => m.location==='van' && m.rep_id===v.rep_id && m.product_id===v.product_id).reduce((a,m)=>a+m.delta,0); if (sum !== v.qty) bad.push({ location:'van', rep_id:v.rep_id, product_id:v.product_id, balance:v.qty, ledger:sum }); });
      s.wh.forEach(w => { const sum = s.moves.filter(m => m.location==='warehouse' && m.product_id===w.product_id).reduce((a,m)=>a+m.delta,0); if (sum !== w.qty) bad.push({ location:'warehouse', product_id:w.product_id, balance:w.qty, ledger:sum }); });
      return bad;
    },
    cashExpectedToday(s){
      const today = todayKey();
      return s.users.filter(u => u.role==='rep' && u.active).map(u => ({ rep:u,
        amount: r2(s.invoices.filter(i => i.rep_id===u.id && i.status==='posted' && dayKey(i.synced_at)===today).reduce((a,i)=>a+(i.payment_type!=='credit'?i.paid_at_sale:0),0)
          + s.colls.filter(c => c.rep_id===u.id && c.method==='cash' && dayKey(c.collected_at)===today).reduce((a,c)=>a+c.amount,0)) }));
    }
  };
