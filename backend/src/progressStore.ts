// Simple in-memory progress store used to publish frequent time updates from ffmpeg
const timeMap: Map<string, number> = new Map();

export function setJobTime(jobId: string, seconds: number) {
  if (typeof seconds === 'number' && !isNaN(seconds) && seconds >= 0) {
    timeMap.set(jobId, seconds);
  }
}

export function getJobTime(jobId: string): number | undefined {
  return timeMap.get(jobId);
}

export function clearJobTime(jobId: string) {
  timeMap.delete(jobId);
}
