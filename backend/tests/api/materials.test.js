const request = require('supertest');
const LearningMaterial = require('../../models/LearningMaterial');
const { createApp, createTestUser, connectToDatabase, disconnectFromDatabase, clearCollections } = require('../setup');

const app = createApp();

beforeAll(connectToDatabase);
afterAll(disconnectFromDatabase);
afterEach(clearCollections);

describe('Learning Materials API — POST /api/materials', () => {
  test('should create a material', async () => {
    const { user, token } = await createTestUser();

    const res = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subject: 'Mathematics',
        topic: 'Algebra Basics',
        content: 'Algebra is a branch of mathematics dealing with symbols and rules.',
        difficulty: 'beginner',
        tags: ['algebra', 'equations'],
        createdBy: user._id
      });

    expect(res.status).toBe(201);
    expect(res.body.material.topic).toBe('Algebra Basics');
    expect(res.body.material.subject).toBe('Mathematics');
  });

  test('should reject material with missing required fields', async () => {
    const { token } = await createTestUser();

    const res = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'Incomplete' });

    expect(res.status).toBe(400);
  });
});

describe('Learning Materials API — GET /api/materials', () => {
  test('should list materials with filters', async () => {
    const { user, token } = await createTestUser();
    await LearningMaterial.create({
      subject: 'Science', topic: 'Biology',
      content: 'Biology is the study of life.',
      difficulty: 'beginner',
      createdBy: user._id, isPublished: true
    });
    await LearningMaterial.create({
      subject: 'Mathematics', topic: 'Calculus',
      content: 'Calculus is the study of change.',
      difficulty: 'advanced',
      createdBy: user._id, isPublished: true
    });

    const res = await request(app)
      .get('/api/materials?subject=Science')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.materials.length).toBe(1);
    expect(res.body.materials[0].subject).toBe('Science');
  });

  test('should search by keyword', async () => {
    const { user, token } = await createTestUser();
    await LearningMaterial.create({
      subject: 'Science', topic: 'Photosynthesis',
      content: 'Plants convert sunlight into energy.',
      difficulty: 'intermediate',
      createdBy: user._id, isPublished: true
    });

    const res = await request(app)
      .get('/api/materials?search=Photosynthesis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.materials.length).toBeGreaterThanOrEqual(1);
  });

  test('should paginate materials', async () => {
    const { user, token } = await createTestUser();
    for (let i = 0; i < 5; i++) {
      await LearningMaterial.create({
        subject: 'English', topic: `Topic ${i}`,
        content: `Content for topic ${i}`,
        difficulty: 'beginner',
        createdBy: user._id, isPublished: true
      });
    }

    const res = await request(app)
      .get('/api/materials?limit=2&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.materials.length).toBe(2);
    expect(res.body.pagination.totalItems).toBe(5);
    expect(res.body.pagination.totalPages).toBe(3);
  });
});

describe('Learning Materials API — GET /api/materials/:id', () => {
  test('should return a single material', async () => {
    const { user, token } = await createTestUser();
    const material = await LearningMaterial.create({
      subject: 'English', topic: 'Grammar',
      content: 'Grammar is the set of structural rules.',
      difficulty: 'beginner',
      createdBy: user._id, isPublished: true
    });

    const res = await request(app)
      .get(`/api/materials/${material._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('Grammar');
  });

  test('should return 404 for non-existent material', async () => {
    const { token } = await createTestUser();
    const fakeId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .get(`/api/materials/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('Learning Materials API — PUT /api/materials/:id', () => {
  test('should update a material', async () => {
    const { user, token } = await createTestUser();
    const material = await LearningMaterial.create({
      subject: 'Science', topic: 'Physics',
      content: 'Physics is the study of matter and energy.',
      difficulty: 'intermediate',
      createdBy: user._id, isPublished: true
    });

    const res = await request(app)
      .put(`/api/materials/${material._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        topic: 'Advanced Physics',
        subject: 'Science',
        content: 'Physics is the study of matter and energy.',
        difficulty: 'advanced'
      });

    expect(res.status).toBe(200);
    expect(res.body.material.topic).toBe('Advanced Physics');
    expect(res.body.material.difficulty).toBe('advanced');
  });
});

describe('Learning Materials API — DELETE /api/materials/:id', () => {
  test('should delete a material', async () => {
    const { user, token } = await createTestUser();
    const material = await LearningMaterial.create({
      subject: 'History', topic: 'Ancient History',
      content: 'Ancient history covers early civilizations.',
      difficulty: 'beginner',
      createdBy: user._id, isPublished: true
    });

    const res = await request(app)
      .delete(`/api/materials/${material._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const deleted = await LearningMaterial.findById(material._id);
    expect(deleted).toBeNull();
  });
});
