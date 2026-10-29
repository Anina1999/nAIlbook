/** Always with cents: `2500` → «25,00 €», `3550` → «35,50 €». */
export function formatPrice(priceCents: number): string {
  const euros = Math.floor(priceCents / 100);
  const cents = priceCents % 100;
  return `${euros},${String(cents).padStart(2, '0')} €`;
}

/** `60` → «60 мин». */
export function formatDuration(durationMin: number): string {
  return `${durationMin} мин`;
}
