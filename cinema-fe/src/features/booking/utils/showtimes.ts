/** MoMo-style: today's date only shows showtimes that haven't started yet. */
export function getAvailableTimes(movieDate: string, rawTimes: string[]) {
  const today = new Date().toISOString().split('T')[0];
  if (movieDate !== today) return rawTimes;
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  return rawTimes.filter((time) => time >= nowHHMM);
}
