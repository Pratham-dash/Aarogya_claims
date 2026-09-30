const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export const formatMoney = (n) => (n == null ? '—' : money.format(n));
export const formatDate = (d) => (d ? date.format(new Date(d)) : '—');
export const formatDateTime = (d) => (d ? dateTime.format(new Date(d)) : '—');
export const shortId = (id) => id.slice(-6).toUpperCase();
export const homeFor = (role) => (role === 'insurer' ? '/insurer' : '/patient');

/** yyyy-mm-dd (from <input type=date>) -> ISO instant at the start/end of that day in the user's timezone */
export const dayStartISO = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toISOString() : '');
export const dayEndISO = (ymd) => (ymd ? new Date(`${ymd}T23:59:59.999`).toISOString() : '');
