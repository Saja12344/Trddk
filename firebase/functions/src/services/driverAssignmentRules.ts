export function decideBusAssignment(input: {
  busRouteId?: string | null;
  occupantDriverId?: string | null;
  occupantName?: string | null;
  driverId?: string | null;
  activeTrip: boolean;
  replace: boolean;
}): { ok: true; routeId: string } | { ok: false; message: string } {
  if (!input.busRouteId) {
    return {
      ok: false,
      message: "هذا الباص غير مربوط بخط. أضفه من صفحة الخط أولاً.",
    };
  }

  const occupantIsSomeoneElse =
    Boolean(input.occupantDriverId) && input.occupantDriverId !== input.driverId;

  if (input.activeTrip && occupantIsSomeoneElse) {
    return {
      ok: false,
      message: "الباص في رحلة مفتوحة. أنهِ الرحلة قبل تغيير السائق.",
    };
  }
  if (input.activeTrip && !input.occupantDriverId) {
    return {
      ok: false,
      message: "الباص في رحلة مفتوحة. أنهِ الرحلة قبل تغيير السائق.",
    };
  }

  if (occupantIsSomeoneElse && !input.replace) {
    const name = input.occupantName?.trim() || "سائق آخر";
    return { ok: false, message: `الباص مربوط بالسائق ${name}.` };
  }

  return { ok: true, routeId: input.busRouteId };
}

export function decideBusRouteMove(activeTrip: boolean):
  | { ok: true }
  | { ok: false; message: string } {
  if (activeTrip) {
    return {
      ok: false,
      message: "الباص في رحلة مفتوحة. أنهِ الرحلة قبل نقله إلى خط آخر.",
    };
  }
  return { ok: true };
}
