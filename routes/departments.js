const pool = require("../db");
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    pool.query("SELECT * FROM departments", (error, results) => {
      if (error) {
        throw error;
      }
      res.send(results.rows);
    });
  });

module.exports = router