import { describe, it, expect } from "vitest";
import { AppError } from "../src/error/app.error.base.js";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from "../src/error/strategy/error.strategy.js";

describe("Error Strategy Classes", () => {
  describe("AppError base", () => {
    it("extends GraphQLError", () => {
      const err = new AppError("test", "TEST", 400, true);
      expect(err.message).toBe("test");
      expect(err.extensions.code).toBe("TEST");
      expect(err.extensions.http.status).toBe(400);
      expect(err.isOperational).toBe(true);
    });

    it("marks non-operational errors", () => {
      const err = new AppError("crash", "CRASH", 500, false);
      expect(err.isOperational).toBe(false);
    });
  });

  describe("ValidationError", () => {
    it("has BAD_USER_INPUT code and 400 status", () => {
      const err = new ValidationError({ message: "bad input" });
      expect(err.extensions.code).toBe("BAD_USER_INPUT");
      expect(err.extensions.http.status).toBe(400);
      expect(err.isOperational).toBe(true);
    });
  });

  describe("BadRequestError", () => {
    it("has BAD_REQUEST code and 400 status", () => {
      const err = new BadRequestError("Invalid request");
      expect(err.message).toBe("Invalid request");
      expect(err.extensions.code).toBe("BAD_REQUEST");
      expect(err.extensions.http.status).toBe(400);
      expect(err.isOperational).toBe(true);
    });
  });

  describe("NotFoundError", () => {
    it("has NOT_FOUND code and 404 status", () => {
      const err = new NotFoundError("Resource missing");
      expect(err.message).toBe("Resource missing");
      expect(err.extensions.code).toBe("NOT_FOUND");
      expect(err.extensions.http.status).toBe(404);
      expect(err.isOperational).toBe(true);
    });
  });

  describe("ConflictError", () => {
    it("has CONFLICT code and 409 status", () => {
      const err = new ConflictError("Already exists");
      expect(err.message).toBe("Already exists");
      expect(err.extensions.code).toBe("CONFLICT");
      expect(err.extensions.http.status).toBe(409);
      expect(err.isOperational).toBe(true);
    });

    it("has default message", () => {
      const err = new ConflictError();
      expect(err.message).toBe("This resource already exists.");
    });
  });

  describe("InternalServerError", () => {
    it("has INTERNAL_SERVER_ERROR code and 500 status", () => {
      const err = new InternalServerError("Oops");
      expect(err.extensions.code).toBe("INTERNAL_SERVER_ERROR");
      expect(err.extensions.http.status).toBe(500);
      expect(err.isOperational).toBe(false);
    });
  });

  describe("instanceof checks", () => {
    it("all errors are instanceof AppError", () => {
      expect(new ValidationError({}) instanceof AppError).toBe(true);
      expect(new BadRequestError("x") instanceof AppError).toBe(true);
      expect(new NotFoundError("x") instanceof AppError).toBe(true);
      expect(new ConflictError() instanceof AppError).toBe(true);
      expect(new InternalServerError("x") instanceof AppError).toBe(true);
    });
  });
});
