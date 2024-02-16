const Joi = require("joi");
const auth = require("../middleware/auth");
const pool = require("../db");
const express = require("express");
const router = express.Router();

router.post("/", auth, async (req, res) => {
  const schema = Joi.object({
    type: Joi.string().valid("registered", "removed").required(),
    citizen_id: Joi.number().required(),
    department_id: Joi.number().required(),
    date: Joi.date().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    // Start a transaction
    await pool.query("BEGIN");

    const { citizen_id, type, department_id, date } = req.body;
    const dateObject = new Date(date);

    if (isNaN(dateObject)) {
      return res.status(400).send("Invalid release_date format");
    }

    const formattedDate = dateObject.toISOString();

    const selectCitizenQuery = `SELECT * FROM citizens WHERE id = $1`;
    const citizenValues = [citizen_id];
    const citizenResult = await pool.query(selectCitizenQuery, citizenValues);
    if (!citizenResult.rows[0].id) return res.status(400).send("Bad request");
    const personalFileId = citizenResult.rows[0].personal_file_id;

    const insertRecordQuery = `INSERT INTO record_history (type, department_id, personal_file_id, date) VALUES ($1, $2, $3, $4) RETURNING id`;
    const recordValues = [type, department_id, personalFileId, formattedDate];
    const militaryResult = await pool.query(insertRecordQuery, recordValues);
    const insertedRecordId = militaryResult.rows[0].id;

    const insertActionQuery = `
        INSERT INTO actions (user_id, type, citizen_id)
        VALUES ($1, $2, $3)`;
    const actionValues = [req.user.id, "edit", citizen_id];
    await pool.query(insertActionQuery, actionValues);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(201).json({
      message: "Reocrd added successfully",
      record_id: insertedRecordId,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await pool.query("ROLLBACK");
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.put("/:id", auth, async (req, res) => {
  const record_id = Number(req.params.id);

  const schema = Joi.object({
    type: Joi.string().valid("registered", "removed").required(),
    department_id: Joi.number().required(),
    date: Joi.date().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    // Start a transaction
    await pool.query("BEGIN");

    const { type, department_id, date } = req.body;
    const dateObject = new Date(date);

    if (isNaN(dateObject)) {
      return res.status(400).send("Invalid release_date format");
    }

    const formattedDate = dateObject.toISOString();

    const updateRecordQuery = `UPDATE record_history SET type = $1, department_id = $2, date = $3 WHERE id = $4 RETURNING *`;
    const recordValues = [type, department_id, formattedDate, record_id];
    const recordResult = (await pool.query(updateRecordQuery, recordValues))
      .rows[0];
    const personalFileId = recordResult.personal_file_id;

    const selectCitizenQuery = `SELECT * FROM citizens WHERE personal_file_id = $1`;
    const citizenValues = [personalFileId];
    const citizenResult = await pool.query(selectCitizenQuery, citizenValues);
    const citizenId = citizenResult.rows[0].id;

    const insertActionQuery = `
        INSERT INTO actions (user_id, type, citizen_id)
        VALUES ($1, $2, $3)`;
    const actionValues = [req.user.id, "edit", citizenId];
    await pool.query(insertActionQuery, actionValues);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(201).json({
      ...recordResult,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await pool.query("ROLLBACK");
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.delete("/:id", auth, async (req, res) => {
  const record_id = Number(req.params.id);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    const deleteRecordQuery = `DELETE FROM record_history WHERE id = $1 RETURNING id`;
    const recordValues = [record_id];
    const recordResult = await pool.query(deleteRecordQuery, recordValues);
    const deletedRecordId = recordResult.rows[0].id;

    res.status(201).json({
      message: "Record deleted successfully",
      militaryId: deletedRecordId,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
