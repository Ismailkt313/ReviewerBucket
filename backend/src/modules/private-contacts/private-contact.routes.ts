import { Router } from "express";
import {
  getContactIdentity,
  renameContact,
  getMyContacts
} from "./private-contact.controller.js";
import {
  validateContactId,
  validateRenameContact,
  validateGetContactsQuery
} from "./private-contact.validation.js";

const router = Router();

router.get("/", validateGetContactsQuery, getMyContacts);
router.get("/:contactId", validateContactId, getContactIdentity);
router.patch("/:contactId", validateContactId, validateRenameContact, renameContact);

export default router;
