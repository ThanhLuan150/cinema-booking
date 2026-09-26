const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const recipeSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    // One recipe per product. The unique index is the source of truth for "already has a recipe".
    product_id: { type: Number, required: true, unique: true },
    ingredients: {
      type: [
        {
          _id: false,
          inventory_id: { type: Number, required: true },
          quantity: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    note: { type: String, default: '' },
    updated_by: { type: Number, default: null }, // account id
  },
  { timestamps: true },
);

// "Which recipes use this ingredient?" — powers the delete/edit guards on Inventory.
recipeSchema.index({ 'ingredients.inventory_id': 1 });

withCleanJSON(recipeSchema);

module.exports = mongoose.model('Recipe', recipeSchema);
