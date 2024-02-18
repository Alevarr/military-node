const Joi = require("joi");
const auth = require("../middleware/auth");
const express = require("express");
const config = require("config");
const router = express.Router();
const { Pool } = require("pg");
const pool = new Pool({
  user: config.get("user"),
  host: config.get("host"),
  database: config.get("database"),
  password: config.get("password"),
  port: config.get("db_port"),
});

async function insertRecord(connection, req, res) {
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
    const { citizen_id, type, department_id, date } = req.body;

    const dateObject = new Date(date);

    if (isNaN(dateObject)) {
      return res.status(400).send("Invalid release_date format");
    }

    const formattedDate = dateObject.toISOString();

    const selectCitizenQuery = `SELECT * FROM citizens WHERE id = $1`;
    const citizenValues = [citizen_id];
    const citizenResult = await connection.query(
      selectCitizenQuery,
      citizenValues
    );
    if (citizenResult.error) {
      console.log(error);
      res.status(500).send("Server error");
    }
    if (!citizenResult.rows[0].id) return res.status(400).send("Bad request");
    const personalFileId = citizenResult.rows[0].personal_file_id;

    const insertRecordQuery = `INSERT INTO record_history (type, department_id, personal_file_id, date) VALUES ($1, $2, $3, $4) RETURNING id`;
    const recordValues = [type, department_id, personalFileId, formattedDate];
    const militaryResult = await connection.query(
      insertRecordQuery,
      recordValues
    );
    if (militaryResult.error) {
      console.log(error);
      res.status(500).send("Server error");
    }

    const insertActionQuery = `
        INSERT INTO actions (user_id, type, citizen_id)
        VALUES ($1, $2, $3)`;
    const actionValues = [req.user.id, "edit", citizen_id];
    const actionsResult = await connection.query(
      insertActionQuery,
      actionValues
    );
    if (actionsResult.error) {
      console.log(error);
      res.status(500).send("Server error");
    }
  } catch (err) {
    console.log(err);
    throw error;
  }
}

router.post("/", auth, async (req, res) => {
  const connection1 = await pool.connect();
  const connection2 = await pool.connect();

  const insertPromise1 = insertRecord(connection1, req, res);
  const insertPromise2 = insertRecord(connection2, req, res);

  try {
    await Promise.race([insertPromise1, insertPromise2]);
    res.status(201).json({
      message: "Success",
    });
  } catch (error) {
    console.error("One of the inserts failed:", error);
    res.status(500).send("Server error");
  }
});

module.exports = router;
