import {randomUUID} from 'node:crypto';
import jwt from "jsonwebtoken";

const generateToken = (res, userId, version=0) => {
  const token = jwt.sign({ userId, v:version }, process.env.JWT_SECRET, {
    expiresIn: "7d", algorithm: "HS256", jwtid: randomUUID(),
  });

  // Set JWT as an HTTP-Only Cookie
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

export default generateToken;
