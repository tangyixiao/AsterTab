export function isCurrentConfirmedRequest(
  payloadAtClick: string,
  currentPayload: string,
  currentConfirmation: string,
  draftActive: boolean,
): boolean {
  return draftActive
    && payloadAtClick.length > 0
    && payloadAtClick === currentPayload
    && payloadAtClick === currentConfirmation;
}
