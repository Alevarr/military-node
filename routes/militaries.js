const Joi = require("joi");
const auth = require("../middleware/auth");
const pool = require("../db");
const express = require("express");
const router = express.Router();

router.post("/", auth, async (req, res) => {
  const schema = Joi.object({
    citizen_id: Joi.number().required(),
    military_serial: Joi.string()
      .pattern(/^[А-Я]{2}\d{7}$/)
      .required(),
    comment: Joi.string().min(1).optional(),
    release_date: Joi.date().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    const { citizen_id, military_serial, comment, release_date } = req.body;
    const releaseDateObject = new Date(release_date);

    if (isNaN(releaseDateObject)) {
      return res.status(400).send("Invalid release_date format");
    }

    const formattedReleaseDate = releaseDateObject.toISOString();

    await pool.query(`BEGIN WORK;
    LOCK TABLE militaries IN SHARE UPDATE EXCLUSIVE MODE;`);

    const selectCitizenQuery = `SELECT * FROM citizens WHERE id = $1`;
    const citizenValues = [citizen_id];
    const citizenResult = await pool.query(selectCitizenQuery, citizenValues);
    if (!citizenResult.rows[0].id) return res.status(400).send("Bad request");

    //Insert into personal_files table
    const insertMilitaryQuery = `INSERT INTO militaries (citizen_id, military_serial, comment, release_date) VALUES ($1, $2, $3, $4) RETURNING id`;
    const militaryValues = [
      citizen_id,
      military_serial,
      comment,
      formattedReleaseDate,
    ];
    const militaryResult = await pool.query(
      insertMilitaryQuery,
      militaryValues
    );
    if (militaryResult.error) {
      console.log(error);
      res.status(500).send("Server error");
    }
    const insertedMilitaryId = militaryResult.rows[0].id;

    // Insert into actions table
    const insertActionQuery = `
        INSERT INTO actions (user_id, type, citizen_id)
        VALUES ($1, $2, $3)`;
    const actionValues = [req.user.id, "edit", citizen_id];
    const actionResult = await pool.query(insertActionQuery, actionValues);
    if (actionResult.error) {
      console.log(error);
      res.status(500).send("Server error");
    }

    await pool.query("COMMIT WORK;");

    res.status(201).json({
      message: "Military added successfully",
      military_id: insertedMilitaryId,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.put("/:id", auth, async (req, res) => {
  const military_id = Number(req.params.id);

  const schema = Joi.object({
    military_serial: Joi.string()
      .pattern(/^[А-Я]{2}\d{7}$/)
      .required(),
    comment: Joi.string().min(1).optional(),
    release_date: Joi.date().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    // Start a transaction
    await pool.query("BEGIN");

    const { military_serial, comment, release_date } = req.body;
    const releaseDateObject = new Date(release_date);

    if (isNaN(releaseDateObject)) {
      return res.status(400).send("Invalid release_date format");
    }

    const formattedReleaseDate = releaseDateObject.toISOString();

    //Insert into personal_files table
    const updateMilitaryQuery = `UPDATE militaries SET military_serial = $1, comment = $2, release_date = $3 WHERE id = $4  RETURNING *`;
    const militaryValues = [
      military_serial,
      comment,
      formattedReleaseDate,
      military_id,
    ];
    const militaryResult = (
      await pool.query(updateMilitaryQuery, militaryValues)
    ).rows[0];

    // Insert into actions table
    const insertActionQuery = `
        INSERT INTO actions (user_id, type, citizen_id)
        VALUES ($1, $2, $3)`;
    const actionValues = [req.user.id, "edit", militaryResult.citizen_id];
    await pool.query(insertActionQuery, actionValues);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(201).json({
      ...militaryResult,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await pool.query("ROLLBACK");
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.delete("/:id", auth, async (req, res) => {
  const military_id = Number(req.params.id);

  if (req.user.role !== "editor") return res.status(401).send("Access denied.");

  try {
    const deleteMilitaryQuery = `DELETE FROM militaries WHERE id = $1 RETURNING id`;
    const militaryValues = [military_id];
    const militaryResult = await pool.query(
      deleteMilitaryQuery,
      militaryValues
    );
    const deletedMilitaryId = militaryResult.rows[0].id;

    res.status(201).json({
      message: "Military deleted successfully",
      militaryId: deletedMilitaryId,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
