const Joi = require("joi");
const jwt = require("jsonwebtoken");
const config = require("config");
const pool = require("../db");
const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  const schema = Joi.object({
    email: Joi.string().min(5).max(255).required().email(),
    password: Joi.string().min(5).max(255).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  pool.query(
    `SELECT id, email, password, role FROM users WHERE email=$1`,
    [req.body.email],
    (error, results) => {
      if (error) console.log(error);
      if (results.rows[0].password !== req.body.password)
        return res.status(400).send("Invalid email or password.");
      const token = jwt.sign(
        {
          id: results.rows[0].id,
          email: results.rows[0].email,
          role: results.rows[0].role,
        },
        config.get("jwtPrivateKey"),
        { expiresIn: "2m" }
      );
      res.send(token);
    }
  );
});

module.exports = router;
