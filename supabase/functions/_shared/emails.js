// Email templates. Each returns { to, subject, html, text }.
import { minToLabel, prettyDate } from './availability.js';

export const SHOP = {
  name: 'NYC Barbershop',
  address: 'Shop 9, 328 Foxwell Road, Coomera East Shopping Centre, Coomera QLD 4209',
  phone: '0410 823 773',
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;color:#eee">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:24px 0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#1a1a1a;border:1px solid #333;border-radius:8px">
<tr><td style="background:#3a3a3a;padding:18px 24px;border-radius:8px 8px 0 0;font-size:20px;letter-spacing:3px;font-weight:bold;color:#fff">NYC BARBERSHOP</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6;color:#e6e6e6">
<h2 style="margin:0 0 12px;color:#fff;font-size:20px">${esc(title)}</h2>
${bodyHtml}
<p style="margin-top:24px;color:#aaa;font-size:13px">${esc(SHOP.address)}<br>Phone: ${esc(SHOP.phone)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

function apptLine(b, barberName) {
  const who = b.guestName ? ` for ${b.guestName}` : '';
  return `${b.serviceName}${who} with ${barberName} – ${prettyDate(b.date)} at ${minToLabel(b.startMin)}`;
}

export function confirmationEmail({ to, name, bookings, barberNames, siteUrl }) {
  const items = bookings
    .map(
      (b) =>
        `<li style="margin-bottom:10px">${esc(apptLine(b, barberNames[b.barberId]))}<br>
<a href="${esc(siteUrl)}/cancel?token=${esc(b.cancelToken)}" style="color:#bbb;font-size:13px">Cancel this appointment</a></li>`,
    )
    .join('');
  const text =
    `Hi ${name}, your booking at NYC Barbershop is confirmed.\n\n` +
    bookings.map((b) => `- ${apptLine(b, barberNames[b.barberId])}\n  Cancel: ${siteUrl}/cancel?token=${b.cancelToken}`).join('\n') +
    `\n\n${SHOP.address}\nPhone: ${SHOP.phone}`;
  return {
    to,
    subject: 'Your NYC Barbershop booking is confirmed',
    html: layout('Booking confirmed', `<p>Hi ${esc(name)}, thanks for booking with us. See you soon!</p><ul style="padding-left:18px">${items}</ul>
<p style="color:#aaa;font-size:13px">Can't make it? Use the cancel link above any time, or give us a call.</p>`),
    text,
  };
}

export function customerCancelledEmail({ to, name, booking, barberName }) {
  return {
    to,
    subject: 'Your NYC Barbershop booking has been cancelled',
    html: layout('Booking cancelled', `<p>Hi ${esc(name)}, as requested we've cancelled this appointment:</p>
<p><strong>${esc(apptLine(booking, barberName))}</strong></p><p>We hope to see you another time.</p>`),
    text: `Hi ${name}, as requested we've cancelled: ${apptLine(booking, barberName)}.`,
  };
}

export function shopCancelledEmail({ to, name, booking, barberName, reason, siteUrl }) {
  const r = reason ? `<p><strong>Reason:</strong> ${esc(reason)}</p>` : '';
  return {
    to,
    subject: 'Your NYC Barbershop booking has been cancelled',
    html: layout('Booking cancelled', `<p>Hi ${esc(name)}, sorry – we've had to cancel your appointment:</p>
<p><strong>${esc(apptLine(booking, barberName))}</strong></p>${r}
<p>We apologise for the inconvenience. You can <a href="${esc(siteUrl)}/book" style="color:#ddd">book a new time online</a> or call us on ${esc(SHOP.phone)}.</p>`),
    text: `Hi ${name}, sorry – we've had to cancel: ${apptLine(booking, barberName)}.${reason ? ` Reason: ${reason}.` : ''} Book again at ${siteUrl}/book or call ${SHOP.phone}.`,
  };
}

export function barberChangedEmail({ to, name, booking, oldBarberName, newBarberName, siteUrl }) {
  return {
    to,
    subject: 'Change to your NYC Barbershop booking',
    html: layout('Your barber has changed', `<p>Hi ${esc(name)}, ${esc(oldBarberName)} is unavailable for your appointment, so ${esc(newBarberName)} will look after you instead. Your time hasn't changed:</p>
<p><strong>${esc(apptLine(booking, newBarberName))}</strong></p>
<p>If that doesn't suit, you can <a href="${esc(siteUrl)}/cancel?token=${esc(booking.cancelToken)}" style="color:#ddd">cancel here</a> or call us on ${esc(SHOP.phone)}.</p>`),
    text: `Hi ${name}, ${oldBarberName} is unavailable, so ${newBarberName} will look after you instead: ${apptLine(booking, newBarberName)}. Cancel: ${siteUrl}/cancel?token=${booking.cancelToken}`,
  };
}

export function bookingChangedEmail({ to, name, before, after, oldBarberName, newBarberName, siteUrl }) {
  return {
    to,
    subject: 'Change to your NYC Barbershop booking',
    html: layout('Your booking has been updated', `<p>Hi ${esc(name)}, we've updated your appointment.</p>
<p style="color:#aaa">Was: ${esc(apptLine(before, oldBarberName))}</p>
<p><strong>Now: ${esc(apptLine(after, newBarberName))}</strong></p>
<p>If that doesn't suit, you can <a href="${esc(siteUrl)}/cancel?token=${esc(after.cancelToken)}" style="color:#ddd">cancel here</a> or call us on ${esc(SHOP.phone)}.</p>`),
    text: `Hi ${name}, your appointment has changed. Was: ${apptLine(before, oldBarberName)}. Now: ${apptLine(after, newBarberName)}. Cancel: ${siteUrl}/cancel?token=${after.cancelToken}`,
  };
}

export function reminderEmail({ to, name, booking, barberName, siteUrl }) {
  return {
    to,
    subject: `Reminder: your NYC Barbershop booking tomorrow at ${minToLabel(booking.startMin)}`,
    html: layout('See you tomorrow', `<p>Hi ${esc(name)}, just a reminder about your appointment:</p>
<p><strong>${esc(apptLine(booking, barberName))}</strong></p>
<p>Can't make it? Please <a href="${esc(siteUrl)}/cancel?token=${esc(booking.cancelToken)}" style="color:#ddd">cancel here</a> so someone else can take the spot, or call us on ${esc(SHOP.phone)}.</p>`),
    text: `Hi ${name}, reminder: ${apptLine(booking, barberName)}. Can't make it? Cancel: ${siteUrl}/cancel?token=${booking.cancelToken} or call ${SHOP.phone}.`,
  };
}

export function reviewRequestEmail({ to, name, booking, barberName, reviewUrl, unsubscribeUrl, bookUrl }) {
  const first = String(name || '').split(' ')[0] || 'there';
  return {
    to,
    subject: `Thanks for coming in, ${first}! How was your cut?`,
    html: layout('Thanks for coming in', `<p>Hi ${esc(first)}, thanks for visiting NYC Barbershop${barberName ? ` and sitting with ${esc(barberName)}` : ''} for your ${esc(booking.serviceName.toLowerCase())}.</p>
<p>If you were happy with it, a quick Google review would mean a lot – it only takes a minute and helps other locals find us.</p>
<p style="margin:24px 0"><a href="${esc(reviewUrl)}" style="background:#f2f2f2;color:#111;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;letter-spacing:1px">★ LEAVE A REVIEW</a></p>
<p>Not quite right? Just reply to this email or call us – we'll make it right.</p>
<p><a href="${esc(bookUrl)}" style="color:#ddd">Book your next cut</a></p>
<p style="color:#888;font-size:12px;margin-top:24px">Don't want emails like this? <a href="${esc(unsubscribeUrl)}" style="color:#888">Unsubscribe</a></p>`),
    text: `Hi ${first}, thanks for coming in to NYC Barbershop. If you were happy with your ${booking.serviceName.toLowerCase()}, a quick Google review would mean a lot: ${reviewUrl}\nNot quite right? Reply or call ${SHOP.phone}.\nBook again: ${bookUrl}\nUnsubscribe: ${unsubscribeUrl}`,
  };
}
