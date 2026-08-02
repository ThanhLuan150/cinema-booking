const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

describe('withCleanJSON', () => {
  it('strips _id and the version key from toJSON output', () => {
    const schema = new mongoose.Schema({ name: String });
    withCleanJSON(schema);
    const Model = mongoose.model('CleanJsonTestModel', schema);
    const doc = new Model({ name: 'Test' });

    const json = doc.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.name).toBe('Test');

    mongoose.deleteModel('CleanJsonTestModel');
  });
});
