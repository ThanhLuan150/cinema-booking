require('dotenv').config();

const connectDB = require('../config/db');
const Account = require('../models/Account');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Seat = require('../models/Seat');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Category = require('../models/Category');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Actor = require('../models/Actor');
const Director = require('../models/Director');
const MovieActor = require('../models/MovieActor');
const MovieDirector = require('../models/MovieDirector');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Refund = require('../models/Refund');
const Combo = require('../models/Combo');
const ComboOrder = require('../models/ComboOrder');
const Inventory = require('../models/Inventory');
const Voucher = require('../models/Voucher');
const Promotion = require('../models/Promotion');
const PricingRule = require('../models/PricingRule');
const Holiday = require('../models/Holiday');
const Shift = require('../models/Shift');
const ShiftAssignment = require('../models/ShiftAssignment');
const Review = require('../models/Review');
const SupportTicket = require('../models/SupportTicket');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Entrance = require('../models/Entrance');
const Device = require('../models/Device');
const AuditLog = require('../models/AuditLog');

const ID_BASE = 900000;
let seq = 0;
const nid = () => ID_BASE + (seq += 1);

const COUNTED = [
  Account, Branch, Room, Seat, Employee, Movie, MovieCategory, Actor, Director, MovieActor,
  MovieDirector, Schedule, Ticket, Booking, Payment, Invoice, Combo, ComboOrder, Inventory,
  Voucher, Promotion, PricingRule, Holiday, Shift, ShiftAssignment, Review, SupportTicket,
  MaintenanceRequest, Entrance, Device, AuditLog,
];

const SEAT_PRICE = 90000;
const COMBO_TIERS = [0, 65000, 120000];
const DAYS_OF_HISTORY = 12;

function isoDay(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split('T')[0];
}
function atDay(daysAgo, hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}
function atFutureDay(daysAhead, hour = 8) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

async function resumeIdCounter() {
  for (const M of COUNTED) {
    const doc = await M.findOne({ id: { $gte: ID_BASE } }).sort({ id: -1 }).select('id').lean();
    if (doc && doc.id - ID_BASE > seq) seq = doc.id - ID_BASE;
  }
}

async function section(label, isDone, body) {
  if (await isDone()) {
    console.log(`•  ${label} — already present, skipped`);
    return;
  }
  const note = await body();
  console.log(`✓  ${label}${note ? ` — ${note}` : ''}`);
}

async function ensureAccount({ email, name, role }) {
  const existing = await Account.findOne({ email });
  if (existing) return existing;
  return Account.create({
    id: nid(),
    email,
    password: 'demo-only-not-hashed',
    name,
    role,
    status: 1,
    verified: true,
  });
}

async function run() {
  await connectDB();
  await resumeIdCounter();

  const admin = await Account.findOne({ role: 0 });
  if (!admin) {
    console.error('No admin account found — run `yarn seed` first.');
    process.exit(1);
  }
  const position =
    (await Position.findOne({ code: 'TICKET_STAFF' })) || (await Position.findOne());
  if (!position) {
    console.error('No positions found — run `yarn seed` first.');
    process.exit(1);
  }
  const categories = await Category.find().sort({ id: 1 }).lean();

  const company =
    (await Company.findOne({ code: 'DEFAULT' })) ||
    (await Company.create({ id: nid(), name: 'Default Company', code: 'DEFAULT', status: 'ACTIVE' }));

  // --- Branches + rooms -----------------------------------------------------
  const wantedBranches = [
    { name: 'Default Cinema', code: 'DEFAULT-01' },
    { name: 'CineNova Central', code: 'DEMO-BR-CENTRAL' },
    { name: 'CineNova Riverside', code: 'DEMO-BR-RIVER' },
  ];
  const branches = [];
  for (const w of wantedBranches) {
    let b = await Branch.findOne({ name: w.name });
    if (!b) {
      b = await Branch.create({
        id: nid(),
        company_id: company.id,
        owner_id: admin.id,
        name: w.name,
        code: w.code,
        status: 'ACTIVE',
      });
    }
    branches.push(b);
  }

  const roomByBranch = new Map();
  for (const b of branches) {
    let room = await Room.findOne({ cinema_id: b.id });
    if (!room) {
      room = await Room.create({
        id: nid(),
        cinema_id: b.id,
        name: 'Room 1',
        code: `DEMO-R-${b.id}`,
        type: b === branches[1] ? 'VIP' : '2D',
        capacity: 40,
      });
    }
    roomByBranch.set(b.id, room);
  }

  // --- Seat maps for the demo rooms --------------------------------------------
  await section(
    'Seats',
    async () => Boolean(await Seat.findOne({ room_id: roomByBranch.get(branches[0].id).id })),
    async () => {
      let n = 0;
      for (const b of branches) {
        const room = roomByBranch.get(b.id);
        if (await Seat.findOne({ room_id: room.id })) continue;
        for (const [ri, row] of ['A', 'B', 'C', 'D', 'E'].entries()) {
          for (let col = 1; col <= 8; col += 1) {
            const seatType = row === 'E' ? 2 : ri < 1 ? 1 : 0; // E = couple, A = vip
            await Seat.create({
              id: nid(),
              room_id: room.id,
              row,
              number: col,
              seat_code: `${row}${col}`,
              seat_type: seatType,
              status: 'ACTIVE',
            });
            n += 1;
          }
        }
      }
      return `${n} seats`;
    },
  );

  // --- Staff + customers -----------------------------------------------------
  let empNo = 0;
  const employeesByBranch = new Map(branches.map((b) => [b.id, []]));
  for (const [i, b] of branches.entries()) {
    for (let k = 0; k < (i === 0 ? 3 : 2); k += 1) {
      empNo += 1;
      const account = await ensureAccount({
        email: `demo.emp${empNo}@cinema.local`,
        name: `Demo Staff ${empNo}`,
        role: 3,
      });
      let emp = await Employee.findOne({ user_id: account.id });
      if (!emp) {
        emp = await Employee.create({
          id: nid(),
          user_id: account.id,
          branch_id: b.id,
          employee_code: `DEMO-E${empNo}`,
          position_id: position.id,
          status: 1,
        });
      }
      employeesByBranch.get(b.id).push(emp);
    }
  }
  const customers = [];
  for (let c = 1; c <= 2; c += 1) {
    customers.push(
      await ensureAccount({ email: `demo.customer${c}@cinema.local`, name: `Demo Customer ${c}`, role: 1 }),
    );
  }

  // --- Cast catalogue ------------------------------------------------------
  await section(
    'Actors & directors',
    async () => Boolean(await Actor.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      const actorNames = ['Lan Ngọc', 'Trấn Thành', 'Kaity Nguyễn', 'Thái Hòa', 'Ninh Dương Lan Ngọc', 'Liên Bỉnh Phát'];
      const directorNames = ['Victor Vũ', 'Charlie Nguyễn', 'Lý Hải'];
      const actors = [];
      for (const name of actorNames) {
        actors.push(await Actor.create({ id: nid(), full_name: name, nationality: 'Vietnam' }));
      }
      const directors = [];
      for (const name of directorNames) {
        directors.push(await Director.create({ id: nid(), full_name: name, nationality: 'Vietnam' }));
      }
      global.__demoActors = actors;
      global.__demoDirectors = directors;
      return `${actors.length} actors, ${directors.length} directors`;
    },
  );
  const actors = global.__demoActors || (await Actor.find({ id: { $gte: ID_BASE } }).lean());
  const directors = global.__demoDirectors || (await Director.find({ id: { $gte: ID_BASE } }).lean());

  // --- Movies + links ----------------------------------------------------------
  const movieNames = ['Nova Horizon', 'The Last Reel', 'Midnight in Hanoi', 'Paper Tigers'];
  const movies = [];
  for (const [i, name] of movieNames.entries()) {
    let movie = await Movie.findOne({ name });
    if (!movie) {
      movie = await Movie.create({
        id: nid(),
        name,
        status: 'ACTIVE',
        premiere_date: isoDay(30),
        duration: 105 + i * 8,
        country: 'Vietnam',
        description: `${name} — demo title seeded for local development.`,
      });
    }
    if (!(await Movie.findOne({ id: movie.id }))) {
      throw new Error(`Demo movie "${name}" (id ${movie.id}) did not persist — aborting.`);
    }
    movies.push(movie);
  }

  await section(
    'Movie ↔ category / cast links',
    async () => Boolean(await MovieActor.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let links = 0;
      for (const [mi, movie] of movies.entries()) {
        if (categories.length) {
          for (const cat of [pick(categories, mi), pick(categories, mi + 2)]) {
            if (!(await MovieCategory.findOne({ movie_id: movie.id, cat_id: cat.id }))) {
              await MovieCategory.create({ id: nid(), movie_id: movie.id, cat_id: cat.id });
              links += 1;
            }
          }
        }
        for (let k = 0; k < 3; k += 1) {
          const actor = pick(actors, mi + k);
          await MovieActor.create({
            id: nid(),
            movie_id: movie.id,
            actor_id: actor.id,
            character_name: `Vai ${k + 1}`,
            is_lead: k === 0,
          });
          links += 1;
        }
        const director = pick(directors, mi);
        await MovieDirector.create({ id: nid(), movie_id: movie.id, director_id: director.id });
        links += 1;
      }
      return `${links} links`;
    },
  );

  // --- Combos catalogue + inventory -----------------------------------------
  const combosByBranch = new Map();
  await section(
    'Combos',
    async () => Boolean(await Combo.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let n = 0;
      for (const b of branches) {
        const rows = [
          { name: 'Bắp ngọt (lớn)', price: 55000, type: 'FOOD' },
          { name: 'Pepsi (lớn)', price: 35000, type: 'BEVERAGE' },
          { name: 'Combo đôi Sweet', price: 129000, type: 'COMBO' },
        ];
        const created = [];
        for (const r of rows) {
          created.push(
            await Combo.create({ id: nid(), cinema_id: b.id, name: r.name, price: r.price, type: r.type, active: true }),
          );
          n += 1;
        }
        combosByBranch.set(b.id, created);
      }
      return `${n} combos`;
    },
  );
  for (const b of branches) {
    if (!combosByBranch.has(b.id)) {
      combosByBranch.set(b.id, await Combo.find({ cinema_id: b.id }).lean());
    }
  }

  await section(
    'Inventory',
    async () => Boolean(await Inventory.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let n = 0;
      const items = [
        { item: 'Bắp nổ (kg)', quantity: 120, minimum_quantity: 20, unit: 'kg' },
        { item: 'Ly giấy', quantity: 850, minimum_quantity: 200, unit: 'cái' },
        { item: 'Syrup Pepsi (lít)', quantity: 12, minimum_quantity: 20, unit: 'lít' },
        { item: 'Nước suối (chai)', quantity: 0, minimum_quantity: 50, unit: 'chai' },
      ];
      for (const b of branches) {
        for (const it of items) {
          const status =
            it.quantity <= 0 ? 'OUT_OF_STOCK' : it.quantity < it.minimum_quantity ? 'LOW_STOCK' : 'IN_STOCK';
          await Inventory.create({ id: nid(), branch_id: b.id, ...it, status });
          n += 1;
        }
      }
      return `${n} items`;
    },
  );

  // --- Vouchers / promotions / pricing rules / holidays --------------------
  await section(
    'Vouchers',
    async () => Boolean(await Voucher.findOne({ code: /^DEMO/ })),
    async () => {
      const rows = [
        { code: 'DEMOWELCOME', cinema_id: null, discount_type: 'PERCENTAGE', discount_value: 10, min_order_value: 100000, max_uses: 500 },
        { code: 'DEMOFLAT50', cinema_id: null, discount_type: 'FIXED_AMOUNT', discount_value: 50000, min_order_value: 250000, max_uses: 200 },
        { code: 'DEMOCENTRAL15', cinema_id: branches[1].id, discount_type: 'PERCENTAGE', discount_value: 15, min_order_value: 150000 },
      ];
      for (const r of rows) {
        await Voucher.create({
          id: nid(),
          ...r,
          valid_from: atDay(3, 0),
          valid_to: atFutureDay(60, 23),
          active: true,
        });
      }
      return `${rows.length} vouchers`;
    },
  );

  await section(
    'Promotions',
    async () => Boolean(await Promotion.findOne({ code: /^DEMO/ })),
    async () => {
      const rows = [
        { code: 'DEMOSUMMER', name: 'Ưu đãi hè', discount_type: 'PERCENTAGE', discount_value: 20, maximum_discount: 80000 },
        { code: 'DEMOMEMBER', name: 'Thành viên VIP', discount_type: 'FIXED_AMOUNT', discount_value: 40000, minimum_order_value: 150000 },
      ];
      for (const r of rows) {
        await Promotion.create({
          id: nid(),
          ...r,
          start_at: atDay(7, 0),
          end_at: atFutureDay(30, 23),
          status: 'ACTIVE',
          branch_ids: [],
          movie_ids: [],
        });
      }
      return `${rows.length} promotions`;
    },
  );

  await section(
    'Pricing rules',
    async () => Boolean(await PricingRule.findOne({ name: /^\[Demo\]/ })),
    async () => {
      const rows = [
        { name: '[Demo] Phụ thu cuối tuần', price: 120000, priority: 10, day_type: 'WEEKEND' },
        { name: '[Demo] Phòng VIP', price: 150000, priority: 20, room_type: 'VIP' },
        { name: '[Demo] Ghế đôi', price: 200000, priority: 15, seat_type: 2 },
        { name: '[Demo] Suất chiếu sáng', price: 70000, priority: 5, time_start: '08:00', time_end: '12:00' },
      ];
      for (const r of rows) await PricingRule.create({ id: nid(), active: true, ...r });
      return `${rows.length} rules`;
    },
  );

  await section(
    'Holidays',
    async () => Boolean(await Holiday.findOne({ name: /^\[Demo\]/ })),
    async () => {
      const rows = [
        { date: `${new Date().getUTCFullYear() + 1}-01-01`, name: '[Demo] Tết Dương lịch' },
        { date: `${new Date().getUTCFullYear()}-09-02`, name: '[Demo] Quốc khánh' },
        { date: `${new Date().getUTCFullYear()}-04-30`, name: '[Demo] Giải phóng miền Nam' },
      ];
      for (const r of rows) await Holiday.create({ id: nid(), branch_id: null, ...r });
      return `${rows.length} holidays`;
    },
  );

  // --- Shifts + assignments -------------------------------------------------
  const shiftsByBranch = new Map();
  await section(
    'Shifts',
    async () => Boolean(await Shift.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let n = 0;
      for (const b of branches) {
        const created = [];
        for (const s of [
          { name: 'Ca sáng', start_time: '08:00', end_time: '16:00' },
          { name: 'Ca tối', start_time: '16:00', end_time: '00:00' },
        ]) {
          created.push(await Shift.create({ id: nid(), branch_id: b.id, status: 'ACTIVE', ...s }));
          n += 1;
        }
        shiftsByBranch.set(b.id, created);
      }
      return `${n} shifts`;
    },
  );
  for (const b of branches) {
    if (!shiftsByBranch.has(b.id)) shiftsByBranch.set(b.id, await Shift.find({ branch_id: b.id }).lean());
  }

  await section(
    'Shift assignments',
    async () => Boolean(await ShiftAssignment.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let n = 0;
      for (const b of branches) {
        const emps = employeesByBranch.get(b.id) || [];
        const [morning] = shiftsByBranch.get(b.id) || [];
        if (!morning || emps.length === 0) continue;
        for (let d = 0; d < 5; d += 1) {
          for (const emp of emps) {
            await ShiftAssignment.create({
              id: nid(),
              employee_id: emp.id,
              shift_id: morning.id,
              branch_id: b.id,
              date: isoDay(-d), // today .. +4 days
              start_at: atFutureDay(d, 8),
              end_at: atFutureDay(d, 16),
              status: 'ACTIVE',
            });
            n += 1;
          }
        }
      }
      return `${n} assignments`;
    },
  );

  // --- Entrances + scanner devices ---------------------------------------------
  const entranceByBranch = new Map();
  await section(
    'Entrances',
    async () => Boolean(await Entrance.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let n = 0;
      for (const b of branches) {
        const created = [];
        for (const e of [
          { name: 'Cổng chính', code: 'MAIN' },
          { name: 'Cổng phụ', code: 'SIDE' },
        ]) {
          created.push(await Entrance.create({ id: nid(), branch_id: b.id, status: 'ACTIVE', ...e }));
          n += 1;
        }
        entranceByBranch.set(b.id, created);
      }
      return `${n} entrances`;
    },
  );
  for (const b of branches) {
    if (!entranceByBranch.has(b.id)) entranceByBranch.set(b.id, await Entrance.find({ branch_id: b.id }).lean());
  }

  await section(
    'Scanner devices',
    async () => Boolean(await Device.findOne({ device_id: /^DEMO-DEV-/ })),
    async () => {
      let n = 0;
      for (const b of branches) {
        const [mainEntrance] = entranceByBranch.get(b.id) || [];
        for (let k = 1; k <= 2; k += 1) {
          await Device.create({
            id: nid(),
            device_id: `DEMO-DEV-${b.id}-${k}`,
            name: `Máy quét ${k} — ${b.name}`,
            branch_id: b.id,
            entrance_id: mainEntrance ? mainEntrance.id : null,
            status: k === 2 ? 'INACTIVE' : 'ACTIVE',
            api_key_hash: 'demo-key-not-real',
            last_seen_at: k === 1 ? atDay(0, 9) : null,
          });
          n += 1;
        }
      }
      return `${n} devices`;
    },
  );

  // --- Schedules + paid bookings (revenue + operational dashboards) --------
  const demoBookings = [];
  await section(
    'Showtimes + paid bookings',
    async () => Boolean(await Booking.findOne({ code: /^DEMO-/ })),
    async () => {
      let bookingCount = 0;
      let ticketCount = 0;
      let gross = 0;
      for (let daysAgo = DAYS_OF_HISTORY - 1; daysAgo >= 0; daysAgo -= 1) {
        for (const [bi, branch] of branches.entries()) {
          const room = roomByBranch.get(branch.id);
          const showsForDay = daysAgo === 0 ? 2 : bi === 0 ? 2 : 1;
          for (let s = 0; s < showsForDay; s += 1) {
            const movie = pick(movies, daysAgo + s + bi);
            const schedule = await Schedule.create({
              id: nid(),
              movie_id: movie.id,
              room_id: room.id,
              cinema_id: branch.id,
              movie_date: isoDay(daysAgo),
              time_begin: `${13 + s * 3}:00`,
              time_end: `${15 + s * 3}:00`,
              price: SEAT_PRICE,
              status: 'ACTIVE',
            });

            const seatCount = 3 + ((daysAgo + s + bi) % 4);
            const ticketIds = [];
            for (let seat = 0; seat < seatCount; seat += 1) {
              const ticketId = nid();
              await Ticket.create({
                id: ticketId,
                schedule_id: schedule.id,
                seat_index: seat,
                seat_code: `A${seat + 1}`,
                status: 0,
              });
              ticketIds.push(ticketId);
            }

            const seatTotal = seatCount * SEAT_PRICE;
            const comboTotal = pick(COMBO_TIERS, daysAgo + bi);
            const discount = (daysAgo + bi) % 5 === 0 ? 20000 : 0;
            const total = seatTotal + comboTotal - discount;
            const code = `DEMO-${schedule.id}`;
            const paidAt = atDay(daysAgo, 12);
            const buyer = pick(customers, daysAgo + bi);

            const booking = await Booking.create({
              id: nid(),
              code,
              account_id: buyer.id,
              schedule_id: schedule.id,
              branch_id: branch.id,
              ticket_ids: ticketIds,
              combo_ids: [],
              discount_amount: discount,
              seat_total: seatTotal,
              combo_total: comboTotal,
              total_price: total,
              status: 'PAID',
              paid_at: paidAt,
            });
            await Payment.create({
              id: nid(),
              code,
              booking_id: booking.id,
              account_id: buyer.id,
              branch_id: branch.id,
              type: 'ONLINE',
              method: 'MOMO',
              amount: total,
              status: 'PAID',
              paid_at: paidAt,
            });
            for (const ticketId of ticketIds) {
              const invoiceId = nid();
              await Invoice.create({
                id: invoiceId,
                booking_id: booking.id,
                ticket_id: ticketId,
                account_id: buyer.id,
                code,
                total_price: Math.round(total / seatCount),
                status: 1,
                ticket_status: 'ISSUED',
                issued_at: paidAt,
                qr_token: `DEMO-QR-${invoiceId}`,
              });
              ticketCount += 1;
            }
            demoBookings.push(booking);
            bookingCount += 1;
            gross += total;
          }
        }
      }
      return `${bookingCount} bookings, ${ticketCount} tickets, ~${gross.toLocaleString()}đ gross`;
    },
  );
  if (demoBookings.length === 0) {
    for (const b of await Booking.find({ code: /^DEMO-/ }).lean()) demoBookings.push(b);
  }

  // --- Combo orders queue (standalone + linked) ------------------------------
  await section(
    'Combo orders',
    async () => Boolean(await ComboOrder.findOne({ code: /^DEMO-CO-LNK-/ })),
    async () => {
      let n = 0;
      // Standalone counter sales (skip any this script already created).
      for (const [i, branch] of branches.entries()) {
        const code = `DEMO-CO-STD-${branch.id}`;
        if (await ComboOrder.findOne({ code })) continue;
        const combo = pick(combosByBranch.get(branch.id) || [], 2);
        const unit = combo ? combo.price : 90000;
        await ComboOrder.create({
          id: nid(),
          code,
          branch_id: branch.id,
          booking_id: null,
          items: [{ combo_id: combo ? combo.id : 1, name: combo ? combo.name : 'Combo demo', unit_price: unit, quantity: 1 + (i % 2), line_total: unit * (1 + (i % 2)) }],
          total_price: unit * (1 + (i % 2)),
          status: 'PAID',
          payment_method: 'CASH',
          paid_at: atDay(1, 15),
        });
        n += 1;
      }
      // Linked to a booking, spread across the fulfilment queue statuses.
      const statuses = ['PENDING', 'PAID', 'PREPARING', 'READY', 'DELIVERED'];
      const targets = demoBookings.slice(0, 10);
      for (const [i, booking] of targets.entries()) {
        const combo = pick(combosByBranch.get(booking.branch_id) || [], i);
        const unit = combo ? combo.price : 65000;
        const qty = 1 + (i % 3);
        await ComboOrder.create({
          id: nid(),
          code: `DEMO-CO-LNK-${booking.id}`,
          branch_id: booking.branch_id,
          account_id: booking.account_id,
          booking_id: booking.id,
          items: [{ combo_id: combo ? combo.id : 1, name: combo ? combo.name : 'Combo demo', unit_price: unit, quantity: qty, line_total: unit * qty }],
          total_price: unit * qty,
          status: pick(statuses, i),
          payment_method: 'MOMO',
          paid_at: pick(statuses, i) === 'PENDING' ? null : atDay(2, 13),
        });
        n += 1;
      }
      return `${n} orders`;
    },
  );

  // --- Completed refunds --------------------------------------------------------
  await section(
    'Refunds',
    async () => Boolean(await Refund.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      const toRefund = demoBookings
        .filter((b) => b.branch_id === branches[0].id)
        .slice(0, 2);
      for (const booking of toRefund) {
        const payment = await Payment.findOne({ booking_id: booking.id });
        await Refund.create({
          id: nid(),
          booking_id: booking.id,
          payment_id: payment.id,
          account_id: booking.account_id,
          branch_id: booking.branch_id,
          amount: Math.round(booking.total_price / 2),
          policy_percent: 50,
          status: 'COMPLETED',
          requested_at: atDay(2, 10),
          decided_at: atDay(2, 11),
          processed_at: atDay(1, 9),
          completed_at: atDay(1, 10),
        });
      }
      return `${toRefund.length} completed`;
    },
  );

  // --- Reviews -------------------------------------------------------------
  await section(
    'Reviews',
    async () => Boolean(await Review.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let n = 0;
      const blurbs = ['Rất đáng xem!', 'Nội dung ổn, hình ảnh đẹp.', 'Tạm ổn cho một buổi tối cuối tuần.', 'Diễn xuất tốt.'];
      for (const [ci, buyer] of customers.entries()) {
        for (const [mi, movie] of movies.entries()) {
          await Review.create({
            id: nid(),
            movie_id: movie.id,
            account_id: buyer.id,
            rating: 4 + ((ci + mi) % 2),
            comment: pick(blurbs, ci + mi),
          });
          n += 1;
        }
        const branch = pick(branches, ci);
        await Review.create({
          id: nid(),
          cinema_id: branch.id,
          account_id: buyer.id,
          rating: 5 - ci,
          comment: 'Rạp sạch sẽ, nhân viên thân thiện.',
        });
        n += 1;
      }
      return `${n} reviews`;
    },
  );

  // --- Support tickets ------------------------------------------------------
  await section(
    'Support tickets',
    async () => Boolean(await SupportTicket.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      const rows = [
        { category: 'BOOKING_SUPPORT', subject: 'Không nhận được vé qua email', status: 'OPEN' },
        { category: 'REFUND_SUPPORT', subject: 'Yêu cầu hoàn tiền suất chiếu bị huỷ', status: 'IN_PROGRESS' },
        { category: 'COMPLAINT', subject: 'Phòng chiếu quá lạnh', status: 'RESOLVED' },
        { category: 'GENERAL', subject: 'Hỏi về chương trình thành viên', status: 'CLOSED' },
      ];
      for (const [i, r] of rows.entries()) {
        const branch = pick(branches, i);
        const staff = (employeesByBranch.get(branch.id) || [])[0];
        await SupportTicket.create({
          id: nid(),
          customer_id: pick(customers, i).id,
          branch_id: branch.id,
          category: r.category,
          subject: r.subject,
          description: 'Ticket demo được seed cho môi trường phát triển.',
          status: r.status,
          created_by: staff ? staff.user_id : admin.id,
          assigned_employee_id: r.status === 'OPEN' ? null : staff ? staff.id : null,
          resolved_at: ['RESOLVED', 'CLOSED'].includes(r.status) ? atDay(1, 14) : null,
          closed_at: r.status === 'CLOSED' ? atDay(1, 15) : null,
        });
      }
      return `${rows.length} tickets`;
    },
  );

  // --- Maintenance requests -----------------------------------------------
  await section(
    'Maintenance requests',
    async () => Boolean(await MaintenanceRequest.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      const rows = [
        { resource_type: 'PROJECTOR', title: 'Máy chiếu phòng 1 bị nhấp nháy', status: 'OPEN' },
        { resource_type: 'AIR_CONDITIONER', title: 'Điều hoà không mát', status: 'ASSIGNED' },
        { resource_type: 'SOUND_SYSTEM', title: 'Loa trái rè', status: 'IN_PROGRESS' },
        { resource_type: 'SEAT', title: 'Ghế C4 bị gãy tay vịn', status: 'RESOLVED' },
      ];
      for (const [i, r] of rows.entries()) {
        const branch = pick(branches, i);
        const staff = (employeesByBranch.get(branch.id) || [])[0];
        await MaintenanceRequest.create({
          id: nid(),
          branch_id: branch.id,
          resource_type: r.resource_type,
          resource_name: r.resource_type === 'SEAT' ? 'Ghế C4' : `${r.resource_type} - Phòng 1`,
          room_id: roomByBranch.get(branch.id).id,
          title: r.title,
          description: 'Yêu cầu bảo trì demo.',
          status: r.status,
          reported_by: staff ? staff.user_id : admin.id,
          assigned_employee_id: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].includes(r.status) && staff ? staff.id : null,
          assigned_at: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].includes(r.status) ? atDay(2, 9) : null,
          started_at: ['IN_PROGRESS', 'RESOLVED'].includes(r.status) ? atDay(2, 10) : null,
          resolved_at: r.status === 'RESOLVED' ? atDay(1, 12) : null,
        });
      }
      return `${rows.length} requests`;
    },
  );

  // --- A few audit-log entries -------------------------------------------------
  await section(
    'Audit log entries',
    async () => Boolean(await AuditLog.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let n = 0;
      for (const movie of movies) {
        await AuditLog.create({
          id: nid(),
          entity_type: 'MOVIE',
          entity_id: movie.id,
          action: 'CREATE_MOVIE',
          performed_by: admin.id,
          branch_id: null,
          metadata: { name: movie.name },
        });
        n += 1;
      }
      for (const booking of demoBookings.slice(0, 6)) {
        await AuditLog.create({
          id: nid(),
          entity_type: 'PAYMENT',
          entity_id: booking.id,
          action: 'PAYMENT_SUCCESS',
          performed_by: booking.account_id,
          branch_id: booking.branch_id,
          metadata: { code: booking.code, amount: booking.total_price },
        });
        n += 1;
      }
      for (const refund of await Refund.find({ id: { $gte: ID_BASE } }).lean()) {
        await AuditLog.create({
          id: nid(),
          entity_type: 'REFUND',
          entity_id: refund.id,
          action: 'REFUND_COMPLETED',
          performed_by: admin.id,
          branch_id: refund.branch_id,
          metadata: { amount: refund.amount },
        });
        n += 1;
      }
      return `${n} entries`;
    },
  );

  console.log('\nDemo seed complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
