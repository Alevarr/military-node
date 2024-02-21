const Joi = require("joi");
const auth = require("../middleware/auth");
const pool = require("../db");
const express = require("express");
const router = express.Router();

router.get("/", auth, (req, res) => {
  pool.query(
    "SELECT citizens.id, citizens.first_name, citizens.middle_name, citizens.last_name, citizens.passport, personal_files.feasibility_category, personal_files.deferment_end_date FROM citizens JOIN personal_files ON citizens.personal_file_id = personal_files.id;",
    (error, results) => {
      if (error) {
        throw error;
      }
      res.send(results.rows);
    }
  );
});

router.get("/:id", (req, res) => {
  const id = req.params.id;
  pool.query(
    `SELECT  
      citizens.id,
      citizens.first_name,
      citizens.middle_name,
      citizens.last_name,
      citizens.passport,
      ARRAY_AGG(DISTINCT jsonb_build_object('id', militaries.id, 'release_date', militaries.release_date, 'military_serial', militaries.military_serial, 'comment', militaries.comment, 'citizen_id', militaries.citizen_id)) AS militaries,
      personal_files.feasibility_category,
      personal_files.deferment_end_date,
      ARRAY_AGG(DISTINCT jsonb_build_object('id', record_history.id, 'type', record_history.type, 'date', record_history.date, 'department', jsonb_build_object('id', departments.id, 'name', departments.name, 'address', departments.address))) AS records,
      ARRAY_AGG(DISTINCT jsonb_build_object('id', actions.id, 'type', actions.type, 'user_email', users.email)) AS actions
    FROM  
      citizens
    LEFT JOIN  
      militaries ON citizens.id = militaries.citizen_id
    LEFT JOIN   
    personal_files ON citizens.personal_file_id = personal_files.id
    LEFT JOIN   
      record_history ON personal_files.id = record_history.personal_file_id
    LEFT JOIN   
    departments ON record_history.department_id = departments.id
    LEFT JOIN
    actions ON actions.citizen_id = citizens.id
    LEFT JOIN
    users ON actions.user_id = users.id
    WHERE
      citizens.id = ${id}
    GROUP BY
     citizens.id,
     personal_files.feasibility_category,
     personal_files.deferment_end_date
    
    `,
    (error, results) => {
      if (error) {
        throw error;
      }
      res.send(results.rows[0]);
    }
  );
});

router.put("/:id", auth, async (req, res) => {
  const citizen_id = Number(req.params.id);

  const schema = Joi.object({
    last_name: Joi.string().min(1).max(255).required(),
    first_name: Joi.string().min(1).max(255).required(),
    middle_name: Joi.string().min(1).max(255).optional(),
    passport: Joi.string()
      .pattern(/^\d{10}$/)
      .required(),
    feasibility_category: Joi.string()
      .valid("А", "Б", "В", "Г", "Д")
      .required(),
    deferment_end_date: Joi.date().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    // Start a transaction
    await pool.query("BEGIN");

    const {
      last_name,
      first_name,
      middle_name,
      passport,
      feasibility_category,
      deferment_end_date,
    } = req.body;
    const defermentEndDateObject = new Date(deferment_end_date);

    if (isNaN(defermentEndDateObject)) {
      return res.status(400).send("Invalid deferment_end_date format");
    }

    const formattedDefermentEndDate = defermentEndDateObject.toISOString();

    const selectCitizenQuery = `SELECT * FROM citizens WHERE id = $1`;
    const citizenValues = [citizen_id];
    const citizenResult = await pool.query(selectCitizenQuery, citizenValues);
    if (!citizenResult.rows[0].id) return res.status(400).send("Bad request");
    const personalFileId = citizenResult.rows[0].personal_file_id;

    const insertFileQuery = `UPDATE personal_files SET feasibility_category = $1, deferment_end_date = $2 WHERE id = $3 RETURNING *`;
    const fileValues = [
      feasibility_category,
      formattedDefermentEndDate,
      personalFileId,
    ];
    await pool.query(insertFileQuery, fileValues);

    const updateCitizenQuery = `
        UPDATE citizens SET last_name = $1, first_name = $2, middle_name = $3, passport = $4
        WHERE id = $5
        RETURNING *`;
    const updateCitizenValues = [
      last_name,
      first_name,
      middle_name,
      passport,
      citizen_id,
    ];
    await pool.query(updateCitizenQuery, updateCitizenValues);

    // Insert into actions table
    const insertActionQuery = `
        INSERT INTO actions (user_id, type, citizen_id)
        VALUES ($1, $2, $3)`;
    const actionValues = [req.user.id, "edit", citizen_id];
    await pool.query(insertActionQuery, actionValues);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(201).json({
      message: "Citizen edited successfully",
      citizenId: citizen_id,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await pool.query("ROLLBACK");
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.delete("/:id", auth, async (req, res) => {
  const citizen_id = Number(req.params.id);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    // Start a transaction
    await pool.query("BEGIN");

    const selectCitizenQuery = `SELECT * FROM citizens WHERE id = $1`;
    const citizenValues = [citizen_id];
    const citizenResult = await pool.query(selectCitizenQuery, citizenValues);
    if (!citizenResult.rows[0].id) return res.status(400).send("Bad request");
    const personalFileId = citizenResult.rows[0].personal_file_id;

    const deleteFileQuery = `DELETE FROM personal_files WHERE id = $1`;
    const fileValues = [personalFileId];
    await pool.query(deleteFileQuery, fileValues);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(201).json({
      message: "Citizen deleted successfully",
      citizenId: citizen_id,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await pool.query("ROLLBACK");
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.post("/", auth, async (req, res) => {
  const schema = Joi.object({
    last_name: Joi.string().min(1).max(255).required(),
    first_name: Joi.string().min(1).max(255).required(),
    middle_name: Joi.string().min(1).max(255).optional(),
    passport: Joi.string()
      .pattern(/^\d{10}$/)
      .required(),
    feasibility_category: Joi.string()
      .valid("А", "Б", "В", "Г", "Д")
      .required(),
    deferment_end_date: Joi.date().optional(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    // Start a transaction
    await pool.query("BEGIN");

    const {
      last_name,
      first_name,
      middle_name,
      passport,
      feasibility_category,
      deferment_end_date,
    } = req.body;
    const defermentEndDateObject = deferment_end_date ? new Date(deferment_end_date) : undefined;

    const formattedDefermentEndDate =  defermentEndDateObject ? defermentEndDateObject.toISOString() : undefined;

    //Insert into personal_files table
    const insertFileQuery = `INSERT INTO personal_files (feasibility_category, deferment_end_date) VALUES ($1, $2) RETURNING id`;
    const fileValues = [feasibility_category, formattedDefermentEndDate];
    const fileResult = await pool.query(insertFileQuery, fileValues);
    const insertedFileId = fileResult.rows[0].id;

    // Insert into citizens table
    const insertCitizenQuery = `
        INSERT INTO citizens (last_name, first_name, middle_name, passport, personal_file_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`;
    const citizenValues = [
      last_name,
      first_name,
      middle_name,
      passport,
      insertedFileId,
    ];
    const citizenResult = await pool.query(insertCitizenQuery, citizenValues);
    const insertedCitizenId = citizenResult.rows[0].id;

    // Insert into actions table
    const insertActionQuery = `
        INSERT INTO actions (user_id, type, citizen_id)
        VALUES ($1, $2, $3)`;
    const actionValues = [req.user.id, "add", insertedCitizenId];
    await pool.query(insertActionQuery, actionValues);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(201).json({
      message: "Citizen added successfully",
      citizenId: insertedCitizenId,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await pool.query("ROLLBACK");
    res.status(500).send("Server error");
  }
});

module.exports = router;
