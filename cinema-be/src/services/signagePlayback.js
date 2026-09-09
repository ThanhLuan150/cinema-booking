const signageRepository = require('../repositories/signage.repository');
const scheduleRepository = require('../repositories/schedule.repository');
const movieRepository = require('../repositories/movie.repository');
const promotionRepository = require('../repositories/promotion.repository');

// Reason codes for a playlist entry that was filtered out of a screen's live playback.
const DROP = {
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  CONTENT_INACTIVE: 'CONTENT_INACTIVE',
  CONTENT_BRANCH_MISMATCH: 'CONTENT_BRANCH_MISMATCH', // Rule: a Screen only shows Content of its own Branch
  SHOWTIME_NOT_FOUND: 'SHOWTIME_NOT_FOUND',
  SHOWTIME_BRANCH_MISMATCH: 'SHOWTIME_BRANCH_MISMATCH', // Rule: never show a Showtime of another Branch
  SHOWTIME_CANCELLED: 'SHOWTIME_CANCELLED', // Rule: a CANCELLED Showtime must not keep playing
};

function filterPlayableEntries({ screen, entries, contentById, scheduleById }) {
  const playable = [];
  const dropped = [];

  // A screen that is not ACTIVE plays nothing at all.
  if (!screen || screen.status !== 'ACTIVE') {
    return { playable, dropped };
  }

  for (const entry of entries) {
    const content = contentById.get(Number(entry.content_id)) || null;
    if (!content) {
      dropped.push({ entry_id: entry.id, content_id: entry.content_id, code: DROP.CONTENT_NOT_FOUND });
      continue;
    }
    if (content.status !== 'ACTIVE') {
      dropped.push({ entry_id: entry.id, content_id: content.id, code: DROP.CONTENT_INACTIVE });
      continue;
    }
    // Rule 1: a Screen only displays Content that belongs to its own Branch.
    if (Number(content.branch_id) !== Number(screen.branch_id)) {
      dropped.push({ entry_id: entry.id, content_id: content.id, code: DROP.CONTENT_BRANCH_MISMATCH });
      continue;
    }

    if (content.type === 'SHOWTIME') {
      const schedule = scheduleById.get(Number(content.schedule_id)) || null;
      if (!schedule) {
        dropped.push({ entry_id: entry.id, content_id: content.id, code: DROP.SHOWTIME_NOT_FOUND });
        continue;
      }
      // Rule 2: never display a Showtime that belongs to a different Branch.
      if (Number(schedule.cinema_id) !== Number(screen.branch_id)) {
        dropped.push({ entry_id: entry.id, content_id: content.id, code: DROP.SHOWTIME_BRANCH_MISMATCH });
        continue;
      }
      // Rule 3: a CANCELLED Showtime must not keep playing on signage.
      if (schedule.status === 'CANCELLED') {
        dropped.push({ entry_id: entry.id, content_id: content.id, code: DROP.SHOWTIME_CANCELLED });
        continue;
      }
    }

    playable.push({ entry, content });
  }

  playable.sort((a, b) => {
    if (b.entry.priority !== a.entry.priority) return b.entry.priority - a.entry.priority;
    return new Date(a.entry.start_at) - new Date(b.entry.start_at);
  });

  return { playable, dropped };
}

// Decorate a playable {entry, content} pair with the referenced movie / schedule / promotion
// detail a media player needs to render it, without leaking anything a screen shouldn't have.
async function decoratePlayable({ entry, content }) {
  const item = {
    schedule_entry_id: entry.id,
    content_id: content.id,
    type: content.type,
    title: content.title,
    body: content.body,
    image_url: content.image_url,
    priority: entry.priority,
    start_at: entry.start_at,
    end_at: entry.end_at,
  };

  if (content.movie_id) {
    const movie = await movieRepository.findById(content.movie_id);
    if (movie) {
      item.movie = { id: movie.id, name: movie.name, poster: movie.avatar, banner: movie.banner, premiere_date: movie.premiere_date };
      if (!item.image_url) item.image_url = movie.avatar || movie.banner || '';
    }
  }

  if (content.type === 'SHOWTIME' && content.schedule_id) {
    const schedule = await scheduleRepository.findById(content.schedule_id);
    if (schedule) {
      item.showtime = {
        id: schedule.id,
        movie_id: schedule.movie_id,
        movie_date: schedule.movie_date,
        time_begin: schedule.time_begin,
        time_end: schedule.time_end,
        room_id: schedule.room_id,
      };
    }
  }

  if (content.promotion_id) {
    const promotion = await promotionRepository.findById(content.promotion_id);
    if (promotion) {
      item.promotion = {
        id: promotion.id,
        code: promotion.code,
        name: promotion.name,
        description: promotion.description,
        end_at: promotion.end_at,
      };
    }
  }

  return item;
}

// Resolve everything on a screen's playlist that should be on screen right now.
async function resolvePlayback(screenId, { now = new Date() } = {}) {
  const screen = await signageRepository.findScreenById(screenId);
  if (!screen) return null;

  const entries = await signageRepository.findLiveScheduleEntries(screen.id, now);

  const contentIds = [...new Set(entries.map((e) => Number(e.content_id)))];
  const contents = contentIds.length ? await signageRepository.findContentByIds(contentIds) : [];
  const contentById = new Map(contents.map((c) => [c.id, c]));

  // Only SHOWTIME content needs its Schedule loaded for the branch / cancelled checks.
  const scheduleIds = [
    ...new Set(
      contents
        .filter((c) => c.type === 'SHOWTIME' && c.schedule_id != null)
        .map((c) => Number(c.schedule_id)),
    ),
  ];
  const scheduleById = new Map();
  for (const sid of scheduleIds) {
    const schedule = await scheduleRepository.findById(sid);
    if (schedule) scheduleById.set(sid, schedule);
  }

  const { playable, dropped } = filterPlayableEntries({ screen, entries, contentById, scheduleById });
  const items = [];
  for (const p of playable) items.push(await decoratePlayable(p));

  return {
    screen: { id: screen.id, name: screen.name, branch_id: screen.branch_id, status: screen.status, location: screen.location },
    generated_at: now,
    items,
    dropped,
  };
}

module.exports = { DROP, filterPlayableEntries, decoratePlayable, resolvePlayback };
