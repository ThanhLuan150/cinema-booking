require('dotenv').config();

const bcrypt = require('bcryptjs');
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
const ParkingArea = require('../models/ParkingArea');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingTicket = require('../models/ParkingTicket');
const EventPackage = require('../models/EventPackage');
const PrivateEvent = require('../models/PrivateEvent');
const Integration = require('../models/Integration');
const Webhook = require('../models/Webhook');
const { calculateParkingFee } = require('../services/parkingFee');
const { generateParkingTicketCode } = require('../utils/parkingTicketCode');

const ID_BASE = 900000;
let seq = 0;
const nid = () => ID_BASE + (seq += 1);

const COUNTED = [
  Account, Branch, Room, Seat, Employee, Movie, MovieCategory, Actor, Director, MovieActor,
  MovieDirector, Schedule, Ticket, Booking, Payment, Invoice, Combo, ComboOrder, Inventory,
  Voucher, Promotion, PricingRule, Holiday, Shift, ShiftAssignment, Review, SupportTicket,
  MaintenanceRequest, Entrance, Device, AuditLog, ParkingArea, ParkingSlot, ParkingTicket,
  EventPackage, PrivateEvent, Integration, Webhook,
];

const SEAT_PRICE = 90000;
const COMBO_TIERS = [0, 65000, 120000];
const DAYS_OF_HISTORY = 12;

function isoDay(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split('T')[0];
}
function isoDayAhead(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
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

  // --- Parking areas, slots & tickets (Ticket 39) -------------------------
  await section(
    'Parking',
    async () => Boolean(await ParkingArea.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      let areaCount = 0;
      let slotCount = 0;
      let ticketCount = 0;

      // One car lot + one motorbike lot per branch.
      for (const b of branches) {
        const carLot = await ParkingArea.create({
          id: nid(), branch_id: b.id, name: 'Bãi ô tô B1', capacity: 12, status: 'ACTIVE',
        });
        const bikeLot = await ParkingArea.create({
          id: nid(), branch_id: b.id, name: 'Bãi xe máy', capacity: 30, status: 'ACTIVE',
        });
        areaCount += 2;

        const carSlots = [];
        for (let i = 1; i <= 8; i += 1) {
          carSlots.push(
            await ParkingSlot.create({
              id: nid(),
              parking_area_id: carLot.id,
              slot_code: `B1-${String(i).padStart(2, '0')}`,
              vehicle_type: 'CAR',
              status: i === 8 ? 'MAINTENANCE' : 'AVAILABLE',
            }),
          );
          slotCount += 1;
        }
        const bikeSlots = [];
        for (let i = 1; i <= 10; i += 1) {
          bikeSlots.push(
            await ParkingSlot.create({
              id: nid(),
              parking_area_id: bikeLot.id,
              slot_code: `M-${String(i).padStart(2, '0')}`,
              vehicle_type: 'MOTORBIKE',
              status: 'AVAILABLE',
            }),
          );
          slotCount += 1;
        }

        // A currently-parked car (ACTIVE, slot OCCUPIED).
        const parkedSlot = carSlots[0];
        await ParkingSlot.updateOne({ id: parkedSlot.id }, { status: 'OCCUPIED' });
        await ParkingTicket.create({
          id: nid(),
          ticket_code: generateParkingTicketCode(),
          branch_id: b.id,
          slot_id: parkedSlot.id,
          vehicle_type: 'CAR',
          vehicle_plate: `51F-${b.id % 1000}.01`,
          entry_at: new Date(Date.now() - 45 * 60 * 1000),
          status: 'ACTIVE',
          fee: 0,
        });
        ticketCount += 1;

        // A motorbike that has exited and is awaiting payment (PENDING_PAYMENT, slot still OCCUPIED).
        const pendingSlot = bikeSlots[0];
        await ParkingSlot.updateOne({ id: pendingSlot.id }, { status: 'OCCUPIED' });
        const pendingEntry = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const pendingExit = new Date(Date.now() - 5 * 60 * 1000);
        await ParkingTicket.create({
          id: nid(),
          ticket_code: generateParkingTicketCode(),
          branch_id: b.id,
          slot_id: pendingSlot.id,
          vehicle_type: 'MOTORBIKE',
          vehicle_plate: `59X1-${b.id % 1000}.22`,
          entry_at: pendingEntry,
          exit_at: pendingExit,
          status: 'PENDING_PAYMENT',
          fee: calculateParkingFee({ entryAt: pendingEntry, exitAt: pendingExit, vehicleType: 'MOTORBIKE' }).fee,
        });
        ticketCount += 1;

        // A completed session from earlier today (slot already released).
        const doneEntry = new Date(Date.now() - 8 * 60 * 60 * 1000);
        const doneExit = new Date(Date.now() - 6 * 60 * 60 * 1000);
        await ParkingTicket.create({
          id: nid(),
          ticket_code: generateParkingTicketCode(),
          branch_id: b.id,
          slot_id: carSlots[1].id,
          vehicle_type: 'CAR',
          vehicle_plate: `30G-${b.id % 1000}.77`,
          entry_at: doneEntry,
          exit_at: doneExit,
          status: 'COMPLETED',
          fee: calculateParkingFee({ entryAt: doneEntry, exitAt: doneExit, vehicleType: 'CAR' }).fee,
          paid_at: doneExit,
        });
        ticketCount += 1;
      }

      return `${areaCount} areas, ${slotCount} slots, ${ticketCount} tickets`;
    },
  );

  // --- Private Event & Cinema Rental (Ticket 40) -------------------------
  // Gives a manual tester: a real customer login + a real branch-admin login (both password
  // `demo1234`), a company-wide package catalogue, a dedicated "Events Hub" branch with a
  // future showtime to collide with, and PrivateEvents in every status. Branch isolation is
  // visible by comparing the Events Hub admin (their branch only) with the SUPER_ADMIN.
  await section(
    'Private events',
    async () => Boolean(await PrivateEvent.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      // 1. Package catalogue (company-wide; SUPER_ADMIN maintains it).
      const packageDefs = [
        {
          code: 'PE-BASIC', name: 'Basic Hall Hire', base_price: 3_000_000, max_guests: 60,
          duration_hours: 3, status: 'ACTIVE',
          description: 'Private screening room hire only — bring your own decorations.',
          perks: ['Private auditorium', 'Standard projection & sound'],
        },
        {
          code: 'PE-PREMIUM', name: 'Premium Celebration', base_price: 7_500_000, max_guests: 100,
          duration_hours: 4, status: 'ACTIVE',
          description: 'Room hire with a dedicated host, welcome drinks and a custom pre-roll slide.',
          perks: ['Dedicated host', 'Welcome drinks', 'Custom pre-roll slide', 'Priority parking'],
        },
        {
          code: 'PE-DELUXE', name: 'Deluxe Corporate', base_price: 15_000_000, max_guests: 180,
          duration_hours: 6, status: 'ACTIVE',
          description: 'Full-day corporate package with catering, breakout area and a technical crew.',
          perks: ['Catering', 'Technical crew', 'Breakout area', 'Session recording'],
        },
        {
          code: 'PE-LEGACY', name: 'Legacy Package (retired)', base_price: 5_000_000, max_guests: 80,
          duration_hours: 4, status: 'INACTIVE',
          description: 'No longer offered — kept so historical events keep their package.',
          perks: [],
        },
      ];
      const packages = {};
      for (const def of packageDefs) {
        packages[def.code] =
          (await EventPackage.findOne({ code: def.code })) || (await EventPackage.create({ id: nid(), ...def }));
      }

      // 2. A dedicated Events Hub branch with its own branch admin (password: demo1234) so
      //    "Branch Admin chỉ quản lý Event của Branch mình" can be checked against SUPER_ADMIN.
      const hashed = await bcrypt.hash('demo1234', 10);
      let eventAdmin = await Account.findOne({ email: 'demo.eventadmin@cinema.local' });
      if (!eventAdmin) {
        eventAdmin = await Account.create({
          id: nid(), email: 'demo.eventadmin@cinema.local', password: hashed, name: 'Demo Events Admin',
          phone: '0900000040', role: 2, status: 1, approved: true, verified: true,
        });
      }
      let eventCustomer = await Account.findOne({ email: 'demo.eventcustomer@cinema.local' });
      if (!eventCustomer) {
        eventCustomer = await Account.create({
          id: nid(), email: 'demo.eventcustomer@cinema.local', password: hashed, name: 'Demo Events Customer',
          phone: '0900000041', role: 1, status: 1, approved: true, verified: true,
        });
      }

      let hubBranch = await Branch.findOne({ code: 'DEMO-BR-EVENTS' });
      if (!hubBranch) {
        hubBranch = await Branch.create({
          id: nid(), company_id: company.id, owner_id: eventAdmin.id,
          name: 'CineNova Events Hub', code: 'DEMO-BR-EVENTS', status: 'ACTIVE',
        });
      }
      let grandHall = await Room.findOne({ code: `DEMO-EVENTS-HALL-${hubBranch.id}` });
      if (!grandHall) {
        grandHall = await Room.create({
          id: nid(), cinema_id: hubBranch.id, name: 'Grand Hall', code: `DEMO-EVENTS-HALL-${hubBranch.id}`,
          type: 'VIP', capacity: 200, status: 'ACTIVE',
        });
      }
      // A room that is NOT available — requesting it should return ROOM_NOT_AVAILABLE.
      if (!(await Room.findOne({ code: `DEMO-EVENTS-HALLB-${hubBranch.id}` }))) {
        await Room.create({
          id: nid(), cinema_id: hubBranch.id, name: 'Hall B (under maintenance)',
          code: `DEMO-EVENTS-HALLB-${hubBranch.id}`, type: '2D', capacity: 120, status: 'MAINTENANCE',
        });
      }

      // 3. A future showtime in Grand Hall to test conflict detection against. Kept on its own
      //    day, well away from every seeded event window below.
      const clashDay = isoDayAhead(7);
      await Schedule.create({
        id: nid(), movie_id: movies[0].id, room_id: grandHall.id, cinema_id: hubBranch.id,
        movie_date: clashDay, time_begin: '18:00', time_end: '20:30', price: SEAT_PRICE, status: 'ACTIVE',
      });

      // 4. One PrivateEvent per status. Hub-branch events (visible to the Events Hub admin AND
      //    the SUPER_ADMIN) plus two on CineNova Central (visible to the SUPER_ADMIN only).
      const central = branches[1];
      const centralRoom = roomByBranch.get(central.id);
      const contact = {
        contact_name: 'Trần Thị Sự Kiện', contact_phone: '0912345678', contact_email: 'events@example.com',
      };
      const win = (daysAhead, startHour, hours) => {
        const start = atFutureDay(daysAhead, startHour);
        return { start_at: start, end_at: new Date(start.getTime() + hours * 3600 * 1000) };
      };
      const pastWin = (daysAgo, startHour, hours) => {
        const start = atDay(daysAgo, startHour);
        return { start_at: start, end_at: new Date(start.getTime() + hours * 3600 * 1000) };
      };

      const rows = [
        {
          label: 'REQUESTED', branch: hubBranch, room: grandHall, cust: eventCustomer,
          pkg: 'PE-PREMIUM', guests: 60, title: 'Ra mắt sản phẩm Q4', status: 'REQUESTED', ...win(10, 9, 4),
        },
        {
          label: 'QUOTED', branch: hubBranch, room: grandHall, cust: eventCustomer,
          pkg: 'PE-DELUXE', guests: 120, title: 'Hội nghị khách hàng thường niên', status: 'QUOTED',
          quoted_amount: 16_500_000, quote_notes: 'Đã bao gồm dọn dẹp và kỹ thuật viên.',
          reviewed_by: eventAdmin.id, reviewed_at: new Date(), ...win(12, 14, 4),
        },
        {
          label: 'APPROVED', branch: hubBranch, room: grandHall, cust: eventCustomer,
          pkg: 'PE-BASIC', guests: 40, title: 'Chiếu phim nội bộ đội ngũ', status: 'APPROVED',
          quoted_amount: 3_200_000, reviewed_by: eventAdmin.id, reviewed_at: new Date(),
          approved_at: new Date(), ...win(14, 10, 4),
        },
        {
          label: 'PAID', branch: hubBranch, room: grandHall, cust: eventCustomer,
          pkg: 'PE-PREMIUM', guests: 90, title: 'Tiệc kỷ niệm công ty', status: 'PAID',
          quoted_amount: 8_000_000, reviewed_by: eventAdmin.id, reviewed_at: new Date(),
          approved_at: new Date(), paid_at: new Date(), ...win(16, 17, 4),
        },
        {
          label: 'CONFIRMED', branch: hubBranch, room: grandHall, cust: eventCustomer,
          pkg: 'PE-DELUXE', guests: 150, title: 'Đại hội cổ đông', status: 'CONFIRMED',
          quoted_amount: 15_000_000, reviewed_by: eventAdmin.id, reviewed_at: new Date(),
          approved_at: new Date(), paid_at: new Date(), confirmed_at: new Date(), ...win(18, 12, 4),
        },
        {
          label: 'COMPLETED', branch: hubBranch, room: grandHall, cust: eventCustomer,
          pkg: 'PE-PREMIUM', guests: 80, title: 'Sinh nhật thành viên VIP', status: 'COMPLETED',
          quoted_amount: 7_500_000, reviewed_by: eventAdmin.id, reviewed_at: atDay(9),
          approved_at: atDay(9), paid_at: atDay(8), confirmed_at: atDay(8), completed_at: atDay(5),
          ...pastWin(6, 12, 4),
        },
        {
          label: 'CANCELLED', branch: hubBranch, room: grandHall, cust: eventCustomer,
          pkg: 'PE-BASIC', guests: 30, title: 'Buổi chiếu cộng đồng (đã huỷ)', status: 'CANCELLED',
          cancelled_at: new Date(), cancel_reason: 'Khách đổi kế hoạch.', ...win(11, 9, 3),
        },
        {
          label: 'REQUESTED @ Central', branch: central, room: centralRoom, cust: eventCustomer,
          pkg: 'PE-PREMIUM', guests: 50, title: 'Workshop đối tác', status: 'REQUESTED', ...win(9, 15, 4),
        },
        {
          label: 'QUOTED @ Central', branch: central, room: centralRoom, cust: eventCustomer,
          pkg: 'PE-DELUXE', guests: 100, title: 'Gala tri ân', status: 'QUOTED',
          quoted_amount: 14_000_000, reviewed_by: admin.id, reviewed_at: new Date(), ...win(13, 13, 5),
        },
      ];

      let n = 0;
      for (const r of rows) {
        await PrivateEvent.create({
          id: nid(),
          customer_id: r.cust.id,
          branch_id: r.branch.id,
          room_id: r.room.id,
          package_id: packages[r.pkg].id,
          start_at: r.start_at,
          end_at: r.end_at,
          guest_count: r.guests,
          status: r.status,
          title: r.title,
          notes: 'Yêu cầu demo được tạo bởi seedDemo.',
          ...contact,
          quoted_amount: r.quoted_amount ?? null,
          quote_notes: r.quote_notes ?? '',
          reviewed_by: r.reviewed_by ?? null,
          reviewed_at: r.reviewed_at ?? null,
          approved_at: r.approved_at ?? null,
          paid_at: r.paid_at ?? null,
          confirmed_at: r.confirmed_at ?? null,
          completed_at: r.completed_at ?? null,
          cancelled_at: r.cancelled_at ?? null,
          cancel_reason: r.cancel_reason ?? '',
        });
        n += 1;
      }

      console.log(
        `   ↳ logins: demo.eventcustomer@cinema.local / demo.eventadmin@cinema.local (password: demo1234)\n` +
        `   ↳ conflict check: request "Grand Hall" on ${clashDay} 18:30–20:00 → expect SHOWTIME_CONFLICT\n` +
        `   ↳ availability check: request "Hall B (under maintenance)" → expect ROOM_NOT_AVAILABLE`,
      );
      return `${Object.keys(packages).length} packages, ${n} events (Events Hub + Central)`;
    },
  );

  // --- External Integration & Webhook platform (Ticket 41) ----------------
  // Registers the payment gateway already wired end-to-end (MoMo) plus two unwired
  // categories to show the registry is provider-agnostic, then seeds a Webhook ledger row
  // in every status so the admin monitoring page (and a manual "Retry" click) has something
  // real to look at without needing to fire actual HTTP webhooks first.
  await section(
    'Integrations & Webhooks',
    async () => Boolean(await Integration.findOne({ id: { $gte: ID_BASE } })),
    async () => {
      const momo = await Integration.create({
        id: nid(),
        name: 'MoMo Wallet',
        provider: 'MOMO',
        type: 'PAYMENT_GATEWAY',
        status: 'ACTIVE',
        secret_env_var: 'MOMO_SECRET_KEY',
        description: 'Sandbox MoMo captureWallet gateway — the checkout/IPN flow already live in the booking module.',
      });
      await Integration.create({
        id: nid(),
        name: 'SendGrid',
        provider: 'SENDGRID',
        type: 'EMAIL_PROVIDER',
        status: 'ACTIVE',
        secret_env_var: 'SENDGRID_WEBHOOK_SECRET',
        description: 'Delivery-status callbacks (delivered/bounced/opened) — logged and acknowledged, no business logic wired yet.',
      });
      await Integration.create({
        id: nid(),
        name: 'Twilio SMS',
        provider: 'TWILIO',
        type: 'SMS_PROVIDER',
        status: 'INACTIVE',
        secret_env_var: null,
        description: 'Not yet enabled for this environment.',
      });

      const rows = [
        {
          provider: 'MOMO', event: 'payment.success', external_id: 'BK-DEMO-1:tx-demo-1', status: 'SUCCESS',
          signature_verified: true, attempts: 1, processed_at: new Date(Date.now() - 30 * 60 * 1000),
          payload: { orderId: 'BK-DEMO-1', resultCode: '0', transId: 'tx-demo-1', amount: '270000' },
        },
        {
          provider: 'SENDGRID', event: 'email.delivered', external_id: 'evt-demo-delivered', status: 'SUCCESS',
          signature_verified: true, attempts: 1, processed_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
          payload: { event: 'email.delivered', id: 'evt-demo-delivered', to: 'buyer@example.com' },
        },
        {
          provider: 'SENDGRID', event: 'email.bounced', external_id: 'evt-demo-bounced', status: 'FAILED',
          signature_verified: true, attempts: 3, max_attempts: 5, last_error: 'Simulated downstream timeout',
          next_attempt_at: new Date(Date.now() + 15 * 60 * 1000),
          payload: { event: 'email.bounced', id: 'evt-demo-bounced', to: 'invalid@example.com' },
        },
        {
          provider: 'TWILIO', event: 'sms.status', external_id: 'evt-demo-pending', status: 'PENDING',
          signature_verified: false, attempts: 0,
          payload: { event: 'sms.status', id: 'evt-demo-pending', to: '+84900000000' },
        },
      ];
      for (const r of rows) {
        await Webhook.create({
          id: nid(),
          integration_id: momo.provider === r.provider ? momo.id : undefined,
          provider: r.provider,
          event: r.event,
          external_id: r.external_id,
          payload: r.payload,
          signature_verified: r.signature_verified,
          status: r.status,
          attempts: r.attempts,
          max_attempts: r.max_attempts ?? 5,
          last_attempt_at: r.status === 'PENDING' ? null : new Date(),
          next_attempt_at: r.next_attempt_at ?? null,
          processed_at: r.processed_at ?? null,
          last_error: r.last_error ?? null,
        });
      }

      console.log(
        `   ↳ try it: POST /api/webhooks/sendgrid with a JSON body — no secret is configured yet so ` +
        `an unsigned call is accepted (Integration.secret_env_var points at an unset env var).\n` +
        `   ↳ the FAILED "email.bounced" row is retryable from /Integrations → Webhooks → Retry.`,
      );
      return `3 integrations, ${rows.length} webhooks (one per status)`;
    },
  );

  console.log('\nDemo seed complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
