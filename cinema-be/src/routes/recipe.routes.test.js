const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const recipeRoutes = require('./recipe.routes');
const inventoryRoutes = require('./inventory.routes');
const comboRoutes = require('./combo.routes');
const comboOrderRoutes = require('./comboOrder.routes');
const inventoryRepository = require('../repositories/inventory.repository');
const Branch = require('../models/Branch');
const Combo = require('../models/Combo');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Permission = require('../models/Permission');
const PositionPermission = require('../models/PositionPermission');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const ComboOrder = require('../models/ComboOrder');
const Recipe = require('../models/Recipe');
const AuditLog = require('../models/AuditLog');
const socket = require('../utils/socket');

jest.mock('../utils/socket', () => ({
  emitBranchEvent: jest.fn(),
  emitToAccount: jest.fn(),
  emitToAdmin: jest.fn(),
  emitToBranch: jest.fn(),
  emitToStaff: jest.fn(),
  emitPublic: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/recipes', recipeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/combo', comboRoutes);
app.use('/api/combo-orders', comboOrderRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await connect();
  await Inventory.init();
  await InventoryTransaction.init();
  await Recipe.init();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => {
  jest.clearAllMocks();
  await clearDatabase();
});
afterAll(async () => closeDatabase());

const ADMIN_A = authHeader({ role: 2, accountId: 42 }); // Branch Admin of Branch 1
const ADMIN_B = authHeader({ role: 2, accountId: 43 }); // Branch Admin of Branch 2
const SUPER = authHeader({ role: 0, accountId: 1 });
const CUSTOMER = authHeader({ role: 1, accountId: 900 });
const CONCESSION = authHeader({ role: 3, accountId: 7 }); // CONCESSION_STAFF at Branch 1: sells, no recipe permission
// FNB_STAFF holds no recipe permission by default; seedWorld grants the FNB_STAFF Position recipe.read,
// the way an owner would to let prep staff see what to make.
const FNB = authHeader({ role: 3, accountId: 8 }); // FNB_STAFF at Branch 1: recipe.read only
const LEAD = authHeader({ role: 3, accountId: 9 }); // Branch 1, a dedicated Position with recipe.read + recipe.manage
const FNB_B = authHeader({ role: 3, accountId: 10 }); // FNB_STAFF at Branch 2: recipe.read only

async function grantPositionPermission(position, code, id) {
  const permission = await Permission.findOne({ code });
  await PositionPermission.create({ id, position_id: position.id, permission_id: permission.id, scope: 'BRANCH' });
}

// Branch 1 (owner 42): Large Popcorn + Nachos (FOOD), Coke (FOOD-tracked directly), a bundle;
// Branch 2 (owner 43): its own popcorn. Ingredients are untracked Inventory records.
async function seedWorld() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 43, name: 'Branch B', code: 'B' },
  ]);
  await Combo.create([
    { id: 1, cinema_id: 1, name: 'Large Popcorn', price: 50000, type: 'FOOD', active: true },
    { id: 2, cinema_id: 1, name: 'Nachos', price: 60000, type: 'FOOD', active: true },
    { id: 3, cinema_id: 1, name: 'Coke', price: 20000, type: 'BEVERAGE', active: true },
    {
      id: 4,
      cinema_id: 1,
      name: 'Bundle',
      price: 65000,
      type: 'COMBO',
      active: true,
      items: [
        { item_id: 1, quantity: 1 },
        { item_id: 3, quantity: 1 },
      ],
    },
    { id: 11, cinema_id: 2, name: 'Popcorn B', price: 50000, type: 'FOOD', active: true },
  ]);
  const fnbPosition = await Position.findOne({ code: 'FNB_STAFF' });
  const concessionPosition = await Position.findOne({ code: 'CONCESSION_STAFF' });
  await Employee.create([
    { id: 1, user_id: 7, branch_id: 1, employee_code: 'E1', position_id: concessionPosition.id, status: 1 },
    { id: 2, user_id: 8, branch_id: 1, employee_code: 'E2', position_id: fnbPosition.id, status: 1 },
    { id: 3, user_id: 9, branch_id: 1, employee_code: 'E3', position_id: fnbPosition.id, status: 1 },
    { id: 4, user_id: 10, branch_id: 2, employee_code: 'E4', position_id: fnbPosition.id, status: 1 },
  ]);
  await grantPositionPermission(fnbPosition, 'recipe.read', 9000);
  // Lead = an Employee on a dedicated Position granted both recipe.read and recipe.manage.
  const leadPosition = await Position.create({ id: 900, code: 'FNB_LEAD', name: 'F&B Lead' });
  await grantPositionPermission(leadPosition, 'recipe.read', 9001);
  await grantPositionPermission(leadPosition, 'recipe.manage', 9002);
  await Employee.updateOne({ user_id: 9 }, { position_id: leadPosition.id });

  // g costs: corn 0.05/g, butter 0.4/g, salt 0.01/g
  const corn = await inventoryRepository.create({ branchId: 1, item: 'Corn', sku: 'CORN', quantity: 1000, minimumQuantity: 100, unit: 'g', costPrice: 0.05 });
  const butter = await inventoryRepository.create({ branchId: 1, item: 'Butter', quantity: 100, minimumQuantity: 10, unit: 'g', costPrice: 0.4 });
  const salt = await inventoryRepository.create({ branchId: 1, item: 'Salt', quantity: 1000, minimumQuantity: 10, unit: 'g', costPrice: 0.01 });
  const cheese = await inventoryRepository.create({ branchId: 1, item: 'Cheese', quantity: 500, minimumQuantity: 10, unit: 'g', costPrice: 0.2 });
  const cokeStock = await inventoryRepository.create({ branchId: 1, comboId: 3, item: 'Coke', quantity: 40, minimumQuantity: 5, unit: 'can' });
  const cornB = await inventoryRepository.create({ branchId: 2, item: 'Corn', quantity: 1000, minimumQuantity: 100, unit: 'g' });
  return { corn, butter, salt, cheese, cokeStock, cornB, leadPosition };
}

const popcornBody = (world, overrides = {}) => ({
  product_id: 1,
  ingredients: [
    { inventory_id: world.corn.id, quantity: 150 },
    { inventory_id: world.butter.id, quantity: 20 },
    { inventory_id: world.salt.id, quantity: 5 },
  ],
  ...overrides,
});

const post = (auth, body, path = '') => request(app).post(`/api/recipes${path}`).set('Authorization', auth).send(body);
const put = (auth, id, body) => request(app).put(`/api/recipes/${id}`).set('Authorization', auth).send(body);
const del = (auth, id) => request(app).delete(`/api/recipes/${id}`).set('Authorization', auth);
const get = (auth, path = '') => request(app).get(`/api/recipes${path}`).set('Authorization', auth);
const stockOf = async (id) => (await Inventory.findOne({ id })).quantity;

async function createPopcornRecipe(world, auth = ADMIN_A) {
  const res = await post(auth, popcornBody(world));
  expect(res.status).toBe(201);
  return res.body;
}

describe('creating a recipe', () => {
  it('creates a recipe on a product and returns its ingredients, cost, margin and how many portions can be made', async () => {
    const world = await seedWorld();
    const res = await post(ADMIN_A, popcornBody(world, { note: 'Pop, then butter, then salt' }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      branch_id: 1,
      product_id: 1,
      note: 'Pop, then butter, then salt',
      product: { id: 1, name: 'Large Popcorn', type: 'FOOD', price: 50000 },
      // 150*0.05 + 20*0.4 + 5*0.01
      cost_per_portion: 15.55,
      margin: 49984.45,
      margin_percent: 99.97,
      // corn 1000/150=6, butter 100/20=5, salt 1000/5=200 -> butter limits to 5
      max_servings: 5,
      limiting_ingredient_id: world.butter.id,
      can_make: true,
    });
    expect(res.body.ingredients).toEqual([
      expect.objectContaining({ inventory_id: world.corn.id, item: 'Corn', unit: 'g', quantity: 150, line_cost: 7.5, stock_quantity: 1000 }),
      expect.objectContaining({ inventory_id: world.butter.id, item: 'Butter', quantity: 20, line_cost: 8, stock_quantity: 100 }),
      expect.objectContaining({ inventory_id: world.salt.id, item: 'Salt', quantity: 5, line_cost: 0.05 }),
    ]);
    expect(await Recipe.countDocuments()).toBe(1);
  });

  it('does not move any stock', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    expect(await stockOf(world.corn.id)).toBe(1000);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });

  it('records an audit entry and announces the change to the branch', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    const entry = await AuditLog.findOne({ action: 'RECIPE_CREATED' });
    expect(entry).toMatchObject({ entity_type: 'RECIPE', entity_id: recipe.id, branch_id: 1, performed_by: 42 });
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(1, 'recipe:updated', expect.objectContaining({ action: 'CREATED', id: recipe.id, productId: 1 }));
  });

  it('a Super Admin may create a recipe for any branch', async () => {
    const world = await seedWorld();
    const res = await post(SUPER, { product_id: 11, ingredients: [{ inventory_id: world.cornB.id, quantity: 200 }] });
    expect(res.status).toBe(201);
    expect(res.body.branch_id).toBe(2);
  });

  it.each([
    ['no ingredients', { ingredients: [] }, 400, 'RECIPE_EMPTY'],
    ['ingredients not an array', { ingredients: 'corn' }, 400, 'VALIDATION_ERROR'],
    ['a zero quantity', { ingredients: [{ inventory_id: 'CORN', quantity: 0 }] }, 400, 'VALIDATION_ERROR'],
    ['a note over 500 characters', { note: 'x'.repeat(501) }, 400, 'VALIDATION_ERROR'],
  ])('rejects %s', async (_label, override, status, code) => {
    const world = await seedWorld();
    const body = popcornBody(world, override);
    if (override.ingredients && override.ingredients[0]?.inventory_id === 'CORN') body.ingredients[0].inventory_id = world.corn.id;
    const res = await post(ADMIN_A, body);
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expect(await Recipe.countDocuments()).toBe(0);
  });

  it('rejects negative, non-numeric and duplicate ingredient lines', async () => {
    const world = await seedWorld();
    const negative = await post(ADMIN_A, { product_id: 1, ingredients: [{ inventory_id: world.corn.id, quantity: -5 }] });
    expect(negative.status).toBe(400);
    const text = await post(ADMIN_A, { product_id: 1, ingredients: [{ inventory_id: world.corn.id, quantity: 'lots' }] });
    expect(text.status).toBe(400);
    const dup = await post(ADMIN_A, {
      product_id: 1,
      ingredients: [{ inventory_id: world.corn.id, quantity: 10 }, { inventory_id: world.corn.id, quantity: 20 }],
    });
    expect(dup.body.code).toBe('DUPLICATE_INGREDIENT');
  });

  it('rejects an unknown ingredient', async () => {
    await seedWorld();
    const res = await post(ADMIN_A, { product_id: 1, ingredients: [{ inventory_id: 99999, quantity: 5 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INGREDIENT_NOT_FOUND');
  });

  it("rejects an ingredient from another branch's inventory", async () => {
    const world = await seedWorld();
    const res = await post(ADMIN_A, { product_id: 1, ingredients: [{ inventory_id: world.cornB.id, quantity: 5 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INGREDIENT_BRANCH_MISMATCH');
  });

  it('rejects a directly-tracked product as an ingredient', async () => {
    const world = await seedWorld();
    const res = await post(ADMIN_A, { product_id: 1, ingredients: [{ inventory_id: world.cokeStock.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INGREDIENT_NOT_ALLOWED');
  });

  it('404s an unknown or missing product', async () => {
    const world = await seedWorld();
    expect((await post(ADMIN_A, popcornBody(world, { product_id: 999 }))).status).toBe(404);
    expect((await post(ADMIN_A, popcornBody(world, { product_id: undefined }))).status).toBe(404);
    expect((await post(ADMIN_A, popcornBody(world, { product_id: 'abc' }))).status).toBe(404);
  });

  it('rejects a COMBO bundle (only FOOD/BEVERAGE items have a recipe)', async () => {
    const world = await seedWorld();
    const res = await post(ADMIN_A, popcornBody(world, { product_id: 4 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRODUCT_NOT_RECIPE_ELIGIBLE');
  });

  it('rejects a product that is already stock-tracked directly (it would be deducted twice)', async () => {
    const world = await seedWorld();
    const res = await post(ADMIN_A, { product_id: 3, ingredients: [{ inventory_id: world.corn.id, quantity: 5 }] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRODUCT_ALREADY_TRACKED');
  });

  it('a product has at most one recipe', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const again = await post(ADMIN_A, popcornBody(world));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('RECIPE_ALREADY_EXISTS');
    expect(await Recipe.countDocuments()).toBe(1);
  });
});

describe('editing and deleting a recipe', () => {
  it('PUT replaces the whole ingredient list and recomputes the figures', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    const res = await put(ADMIN_A, recipe.id, { ingredients: [{ inventory_id: world.corn.id, quantity: 100 }, { inventory_id: world.cheese.id, quantity: 25 }] });

    expect(res.status).toBe(200);
    expect(res.body.ingredients.map((i) => i.item)).toEqual(['Corn', 'Cheese']);
    expect(res.body.cost_per_portion).toBe(10); // 100*0.05 + 25*0.2
    expect(res.body.max_servings).toBe(10); // corn 1000/100, cheese 500/25=20
    expect(await AuditLog.countDocuments({ action: 'RECIPE_UPDATED' })).toBe(1);
  });

  it('PUT with only a note leaves the ingredients alone', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    const res = await put(ADMIN_A, recipe.id, { note: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.note).toBe('Updated');
    expect(res.body.ingredients).toHaveLength(3);
  });

  it('an invalid PUT changes nothing', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    expect((await put(ADMIN_A, recipe.id, { ingredients: [] })).status).toBe(400);
    expect((await put(ADMIN_A, recipe.id, { ingredients: [{ inventory_id: world.cornB.id, quantity: 5 }] })).status).toBe(400);
    const stored = await Recipe.findOne({ id: recipe.id });
    expect(stored.ingredients).toHaveLength(3);
  });

  it('404s an unknown recipe', async () => {
    await seedWorld();
    expect((await put(ADMIN_A, 999, { note: 'x' })).status).toBe(404);
    expect((await del(ADMIN_A, 999)).status).toBe(404);
  });

  it('DELETE removes the recipe (and audits it)', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    expect((await del(ADMIN_A, recipe.id)).status).toBe(200);
    expect(await Recipe.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'RECIPE_DELETED' })).toBe(1);
  });
});

describe('reading recipes', () => {
  it('lists recipes with the product and stock figures, and filters by product', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    await post(ADMIN_A, { product_id: 2, ingredients: [{ inventory_id: world.cheese.id, quantity: 100 }] });

    const all = await get(ADMIN_A);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    const filtered = await get(ADMIN_A, '?productId=2');
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0]).toMatchObject({ product_id: 2, max_servings: 5, product: { name: 'Nachos' } });
    expect((await get(ADMIN_A, '?productId=abc')).status).toBe(400);
  });

  it('reflects live stock: an emptied ingredient makes the product un-makeable', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    await inventoryRepository.adjustStock(world.butter.id, { quantity: 0 });
    const res = await get(ADMIN_A, `/${recipe.id}`);
    expect(res.body).toMatchObject({ max_servings: 0, can_make: false, limiting_ingredient_id: world.butter.id });
    expect(res.body.ingredients.find((i) => i.item === 'Butter').status).toBe('OUT_OF_STOCK');
  });

  it('availability answers "can N portions be made?" with the requirement per ingredient', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);

    const ok = await get(ADMIN_A, `/${recipe.id}/availability?servings=5`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ servings: 5, can_make: true, max_servings: 5, shortages: [] });
    expect(ok.body.requirements).toEqual([
      expect.objectContaining({ item: 'Corn', requested: 750, available: 1000 }),
      expect.objectContaining({ item: 'Butter', requested: 100, available: 100 }),
      expect.objectContaining({ item: 'Salt', requested: 25, available: 1000 }),
    ]);

    const over = await get(ADMIN_A, `/${recipe.id}/availability?servings=6`);
    expect(over.body.can_make).toBe(false);
    expect(over.body.shortages).toEqual([expect.objectContaining({ item: 'Butter', requested: 120, available: 100, unit: 'g' })]);
  });

  it.each(['0', '-1', '1.5', 'abc', '100001'])('availability rejects servings=%s', async (servings) => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    expect((await get(ADMIN_A, `/${recipe.id}/availability?servings=${servings}`)).status).toBe(400);
  });

  it('404s an unknown recipe', async () => {
    await seedWorld();
    expect((await get(ADMIN_A, '/999')).status).toBe(404);
    expect((await get(ADMIN_A, '/999/availability')).status).toBe(404);
  });
});

describe('who may change a recipe (RBAC)', () => {
  it('needs authentication', async () => {
    await seedWorld();
    expect((await request(app).get('/api/recipes')).status).toBe(401);
    expect((await request(app).post('/api/recipes').send({})).status).toBe(401);
  });

  it('a customer can neither read nor change recipes', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    expect((await get(CUSTOMER)).status).toBe(403);
    expect((await post(CUSTOMER, popcornBody(world, { product_id: 2 }))).status).toBe(403);
    expect((await put(CUSTOMER, recipe.id, { note: 'x' })).status).toBe(403);
    expect((await del(CUSTOMER, recipe.id)).status).toBe(403);
  });

  it('an Employee WITHOUT the permission cannot create, edit or delete a recipe (nor even read one)', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);

    expect((await post(CONCESSION, popcornBody(world, { product_id: 2 }))).status).toBe(403);
    expect((await put(CONCESSION, recipe.id, { ingredients: [{ inventory_id: world.corn.id, quantity: 1 }] })).status).toBe(403);
    expect((await del(CONCESSION, recipe.id)).status).toBe(403);
    expect((await get(CONCESSION)).status).toBe(403);

    const stored = await Recipe.findOne({ id: recipe.id });
    expect(stored.ingredients.map((i) => i.quantity)).toEqual([150, 20, 5]);
    expect(await Recipe.countDocuments()).toBe(1);
  });

  it('kitchen staff (recipe.read only) can read recipes but not change them', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);

    expect((await get(FNB)).status).toBe(200);
    expect((await get(FNB, `/${recipe.id}`)).status).toBe(200);
    expect((await get(FNB, `/${recipe.id}/availability`)).status).toBe(200);

    expect((await post(FNB, popcornBody(world, { product_id: 2 }))).status).toBe(403);
    expect((await put(FNB, recipe.id, { note: 'hacked' })).status).toBe(403);
    expect((await del(FNB, recipe.id)).status).toBe(403);
    expect((await Recipe.findOne({ id: recipe.id })).note).toBe('');
  });

  it('an Employee whose Position was granted recipe.manage may change recipes of their own branch', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);

    expect((await put(LEAD, recipe.id, { note: 'lead edit' })).body.note).toBe('lead edit');
    const created = await post(LEAD, { product_id: 2, ingredients: [{ inventory_id: world.cheese.id, quantity: 50 }] });
    expect(created.status).toBe(201);
    expect((await del(LEAD, created.body.id)).status).toBe(200);
    expect((await AuditLog.findOne({ action: 'RECIPE_UPDATED' })).performed_by).toBe(9);
  });

  it("…but not a recipe of another branch, even with the permission", async () => {
    const world = await seedWorld();
    const other = await post(SUPER, { product_id: 11, ingredients: [{ inventory_id: world.cornB.id, quantity: 200 }] });
    expect((await put(LEAD, other.body.id, { note: 'x' })).status).toBe(403);
    expect((await del(LEAD, other.body.id)).status).toBe(403);
    expect((await post(LEAD, { product_id: 11, ingredients: [{ inventory_id: world.cornB.id, quantity: 1 }] })).status).toBe(403);
  });

  it("a Branch Admin cannot read or change another branch's recipes", async () => {
    const world = await seedWorld();
    const mine = await createPopcornRecipe(world);
    const other = await post(ADMIN_B, { product_id: 11, ingredients: [{ inventory_id: world.cornB.id, quantity: 200 }] });
    expect(other.status).toBe(201);

    expect((await get(ADMIN_A, `/${other.body.id}`)).status).toBe(403);
    expect((await put(ADMIN_A, other.body.id, { note: 'x' })).status).toBe(403);
    expect((await del(ADMIN_A, other.body.id)).status).toBe(403);
    expect((await post(ADMIN_A, { product_id: 11, ingredients: [{ inventory_id: world.cornB.id, quantity: 1 }] })).status).toBe(403);
    expect((await put(ADMIN_B, mine.id, { note: 'x' })).status).toBe(403);
    expect((await get(ADMIN_A, '?branchId=2')).status).toBe(403);
    expect((await Recipe.findOne({ id: other.body.id })).note).toBe('');
  });

  it("a Branch Admin's list only contains their own branches; a Super Admin sees all", async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    await post(ADMIN_B, { product_id: 11, ingredients: [{ inventory_id: world.cornB.id, quantity: 200 }] });
    expect((await get(ADMIN_A)).body.data.map((r) => r.branch_id)).toEqual([1]);
    expect((await get(SUPER)).body.total).toBe(2);
  });

  it("kitchen staff at branch 2 cannot read branch 1's recipes", async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    expect((await get(FNB_B, `/${recipe.id}`)).status).toBe(403);
    expect((await get(FNB_B, '?branchId=1')).status).toBe(403);
    expect((await get(FNB_B)).body.data).toEqual([]);
  });
});

describe('keeping ingredients and recipes consistent', () => {
  it('an ingredient used by a recipe cannot be deleted until it is removed from the recipe', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);

    const blocked = await request(app).delete(`/api/inventory/${world.corn.id}`).set('Authorization', ADMIN_A);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('INVENTORY_IN_RECIPE');
    expect(await Inventory.countDocuments({ id: world.corn.id })).toBe(1);

    await del(ADMIN_A, recipe.id);
    expect((await request(app).delete(`/api/inventory/${world.corn.id}`).set('Authorization', ADMIN_A)).status).toBe(200);
  });

  it("an ingredient's unit cannot change while a recipe uses it (its quantities would silently change meaning)", async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const locked = await request(app).put(`/api/inventory/${world.corn.id}`).set('Authorization', ADMIN_A).send({ unit: 'kg' });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('INGREDIENT_UNIT_LOCKED');
    expect((await Inventory.findOne({ id: world.corn.id })).unit).toBe('g');

    // Other edits, and re-sending the same unit, are fine.
    const ok = await request(app).put(`/api/inventory/${world.corn.id}`).set('Authorization', ADMIN_A).send({ unit: 'g', minimum_quantity: 50, cost_price: 0.06 });
    expect(ok.status).toBe(200);
  });

  it('an ingredient used by a recipe cannot be turned into a directly-tracked product', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const res = await request(app).put(`/api/inventory/${world.corn.id}`).set('Authorization', ADMIN_A).send({ combo_id: 2 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INGREDIENT_IN_RECIPE');
  });

  it('a product with a recipe cannot also be stock-tracked directly', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const create = await request(app)
      .post('/api/inventory')
      .set('Authorization', ADMIN_A)
      .send({ branch_id: 1, item: 'Popcorn tubs', unit: 'pcs', combo_id: 1, quantity: 10 });
    expect(create.status).toBe(409);
    expect(create.body.code).toBe('PRODUCT_HAS_RECIPE');

    const link = await request(app).put(`/api/inventory/${world.cheese.id}`).set('Authorization', ADMIN_A).send({ combo_id: 1 });
    expect(link.status).toBe(409);
    expect(link.body.code).toBe('PRODUCT_HAS_RECIPE');
  });

  it('a product with a recipe cannot become a COMBO bundle', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const res = await request(app).put('/api/combo/1').set('Authorization', ADMIN_A).send({ type: 'COMBO' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRODUCT_HAS_RECIPE');
    expect((await Combo.findOne({ id: 1 })).type).toBe('FOOD');
  });

  it('deleting a product deletes its recipe', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    expect((await request(app).delete('/api/combo/1').set('Authorization', ADMIN_A)).status).toBe(200);
    expect(await Recipe.countDocuments()).toBe(0);
    expect(await stockOf(world.corn.id)).toBe(1000); // ingredients themselves are kept
  });
});

describe('selling products made from a recipe', () => {
  const placeOrder = (items, auth = CONCESSION) =>
    request(app).post('/api/combo-orders').set('Authorization', auth).send({ branch_id: 1, items });
  const pay = (id, auth = CONCESSION) => request(app).post(`/api/combo-orders/${id}/pay`).set('Authorization', auth).send({ method: 'CASH' });

  it('selling 1 Large Popcorn takes Corn -150g, Butter -20g, Salt -5g when the order is paid', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);

    const created = await placeOrder([{ combo_id: 1, quantity: 1 }]);
    expect(created.status).toBe(201);
    expect(await stockOf(world.corn.id)).toBe(1000); // creating the order alone moves nothing

    expect((await pay(created.body.id)).status).toBe(200);
    expect([await stockOf(world.corn.id), await stockOf(world.butter.id), await stockOf(world.salt.id)]).toEqual([850, 80, 995]);

    const history = await request(app).get(`/api/inventory/${world.butter.id}/history`).set('Authorization', ADMIN_A);
    expect(history.body.data[0]).toMatchObject({ type: 'SALE', quantity_change: -20, quantity_after: 80 });
  });

  it('a Concession Employee without recipe permission can still SELL the product', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const created = await placeOrder([{ combo_id: 1, quantity: 2 }], CONCESSION);
    expect(created.status).toBe(201);
    expect((await pay(created.body.id, CONCESSION)).status).toBe(200);
    expect(await stockOf(world.corn.id)).toBe(700);
  });

  it('refuses to create an order when an ingredient is short (409 INSUFFICIENT_STOCK naming it)', async () => {
    const world = await seedWorld(); // butter 100g = 5 portions
    await createPopcornRecipe(world);
    const res = await placeOrder([{ combo_id: 1, quantity: 6 }]);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', item: 'Butter', requested: 120, available: 100 });
    expect(res.body.shortages[0]).toMatchObject({ ingredient: true, unit: 'g', product_ids: [1] });
    expect(await ComboOrder.countDocuments()).toBe(0);
    expect(await stockOf(world.butter.id)).toBe(100);
  });

  it('allows exactly the last portions the stock can make', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const all = await placeOrder([{ combo_id: 1, quantity: 5 }]);
    expect((await pay(all.body.id)).status).toBe(200);
    expect(await stockOf(world.butter.id)).toBe(0);
    expect((await placeOrder([{ combo_id: 1, quantity: 1 }])).status).toBe(409);
  });

  it('refuses payment (order stays PENDING, nothing deducted) when the stock ran out after the order was created', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const created = await placeOrder([{ combo_id: 1, quantity: 3 }]);
    await inventoryRepository.wasteStock(world.butter.id, { quantity: 90 }); // spoiled in between

    const res = await pay(created.body.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect((await ComboOrder.findOne({ id: created.body.id })).status).toBe('PENDING');
    expect([await stockOf(world.corn.id), await stockOf(world.butter.id), await stockOf(world.salt.id)]).toEqual([1000, 10, 1000]);
  });

  it('two pending orders that each fit alone: the second payment is refused', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const first = await placeOrder([{ combo_id: 1, quantity: 3 }]);
    const second = await placeOrder([{ combo_id: 1, quantity: 3 }]); // 60g each of 100g: both pass the advisory check
    expect((await pay(first.body.id)).status).toBe(200);
    expect((await pay(second.body.id)).status).toBe(409);
    expect(await stockOf(world.butter.id)).toBe(40);
  });

  it('cancelling a paid order puts the ingredients back', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const created = await placeOrder([{ combo_id: 1, quantity: 2 }]);
    await pay(created.body.id);
    expect(await stockOf(world.corn.id)).toBe(700);

    const cancelled = await request(app).post(`/api/combo-orders/${created.body.id}/cancel`).set('Authorization', CONCESSION).send({ reason: 'changed mind' });
    expect(cancelled.status).toBe(200);
    expect([await stockOf(world.corn.id), await stockOf(world.butter.id), await stockOf(world.salt.id)]).toEqual([1000, 100, 1000]);
  });

  it('a bundle containing a recipe product is refused when that product’s ingredients are short', async () => {
    const world = await seedWorld();
    await createPopcornRecipe(world);
    const res = await placeOrder([{ combo_id: 4, quantity: 6 }]); // 6 popcorn = 120g butter of 100g
    expect(res.status).toBe(409);
    expect(res.body.item).toBe('Butter');
    const ok = await placeOrder([{ combo_id: 4, quantity: 2 }]);
    expect(ok.status).toBe(201);
    await pay(ok.body.id);
    expect(await stockOf(world.corn.id)).toBe(700);
    expect(await stockOf(world.cokeStock.id)).toBe(38);
  });

  it('after the recipe is deleted the product is no longer stock-limited by its ingredients', async () => {
    const world = await seedWorld();
    const recipe = await createPopcornRecipe(world);
    await del(ADMIN_A, recipe.id);
    const created = await placeOrder([{ combo_id: 1, quantity: 50 }]);
    expect(created.status).toBe(201);
    expect((await pay(created.body.id)).status).toBe(200);
    expect(await stockOf(world.corn.id)).toBe(1000);
  });
});
