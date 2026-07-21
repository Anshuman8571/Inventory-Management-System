const categoriesModel = require('../models/categories.model');

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.expose = true;
  return err;
}

// Helper to build the full path of a category
function buildPath(category, allCategories) {
  const pathParts = [];
  let current = category;
  while (current) {
    pathParts.unshift(current.name);
    current = allCategories.find((c) => c.name === current.parent_name);
  }
  return pathParts.join(' > ');
}

async function getCategories(req, res, next) {
  try {
    const categories = await categoriesModel.list();
    // Return objects with name and formatted path
    const formattedCategories = categories.map((c) => ({
      name: c.name,
      path: buildPath(c, categories),
    }));
    res.json({ categories: formattedCategories });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const parentName = typeof req.body?.parentName === 'string' ? req.body.parentName.trim() : null;

    if (!name || name.length > 40) {
      throw makeError('Category name must be 1-40 characters.', 400, 'INVALID_INPUT');
    }

    if (parentName) {
      const parent = await categoriesModel.findByNameCaseInsensitive(parentName);
      if (!parent) {
        throw makeError('Parent category not found.', 400, 'INVALID_INPUT');
      }
    }

    const existing = await categoriesModel.findByNameCaseInsensitive(name);
    if (existing) {
      // Just fetch all to build path
      const allCategories = await categoriesModel.list();
      return res.status(200).json({
        category: {
          name: existing.name,
          path: buildPath(existing, allCategories)
        },
        alreadyExisted: true
      });
    }

    const created = await categoriesModel.create(name, parentName || null);
    const allCategories = await categoriesModel.list();
    res.status(201).json({
      category: {
        name: created.name,
        path: buildPath(created, allCategories)
      },
      alreadyExisted: false
    });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const oldName = req.params.name;
    const newName = typeof req.body?.newName === 'string' ? req.body.newName.trim() : '';

    if (!newName || newName.length > 40) {
      throw makeError('Category name must be 1-40 characters.', 400, 'INVALID_INPUT');
    }

    const category = await categoriesModel.findByNameCaseInsensitive(oldName);
    if (!category) throw makeError('Category not found.', 404, 'NOT_FOUND');

    const existing = await categoriesModel.findByNameCaseInsensitive(newName);
    if (existing && existing.name !== category.name) {
      throw makeError('Category with this name already exists.', 409, 'CONFLICT');
    }

    await categoriesModel.update(category.name, newName);
    res.json({ success: true, message: 'Category renamed.' });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const name = req.params.name;
    const category = await categoriesModel.findByNameCaseInsensitive(name);
    if (!category) throw makeError('Category not found.', 404, 'NOT_FOUND');

    await categoriesModel.softDelete(category.name);
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };