import { PrivateContactRepository } from "./private-contact.repository.js";
import { PrivateRoomService } from "../private-rooms/private-room.service.js";
import { AppError } from "../../errors/app-error.js";
import type { ContactIdentityResponse } from "./private-contact.types.js";

export class PrivateContactService {
  private repository = new PrivateContactRepository();
  private privateRoomService = new PrivateRoomService();

  normalizeNickname(nickname: string): string {
    return nickname.trim().replace(/\s+/g, " ").toLowerCase();
  }

  cleanNickname(nickname: string): string {
    return nickname.trim().replace(/\s+/g, " ");
  }

  async getContactIdentity(
    ownerId: string,
    contactId: string
  ): Promise<ContactIdentityResponse> {
    const trimmedOwner = ownerId.trim();
    const trimmedContact = contactId.trim();

    if (!trimmedOwner) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    if (!trimmedContact) {
      throw new AppError(400, "Missing contact ID");
    }

    if (trimmedContact === "admin") {
      return {
        contactId: "admin",
        displayName: "Reviewer Bucket Developer",
        nickname: null,
        isCustomName: false
      };
    }

    // Validate that the contact exists in the system
    const contactExists = await this.privateRoomService.validateTargetUserExists(trimmedContact);
    if (!contactExists) {
      throw new AppError(404, "Contact anonymous user does not exist");
    }

    const contact = await this.repository.findByOwnerAndContact(trimmedOwner, trimmedContact);

    if (contact && contact.nickname) {
      return {
        contactId: trimmedContact,
        displayName: contact.nickname,
        nickname: contact.nickname,
        isCustomName: true,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      };
    }

    return {
      contactId: trimmedContact,
      displayName: "Anonymous User",
      nickname: null,
      isCustomName: false
    };
  }

  async setContactNickname(
    ownerId: string,
    contactId: string,
    rawNickname?: string | null
  ): Promise<ContactIdentityResponse> {
    const trimmedOwner = ownerId.trim();
    const trimmedContact = contactId.trim();

    if (!trimmedOwner) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    if (!trimmedContact) {
      throw new AppError(400, "Missing contact ID");
    }

    if (
      trimmedContact === "admin" ||
      trimmedContact === "broadcast" ||
      trimmedContact === "system" ||
      trimmedContact === "reviewer-bucket" ||
      trimmedContact.toLowerCase() === "reviewer bucket"
    ) {
      throw new AppError(400, "Reviewer Bucket system contact cannot be renamed");
    }

    if (trimmedOwner === trimmedContact) {
      throw new AppError(400, "Cannot create a contact mapping for yourself");
    }

    // Validate contact existence
    const contactExists = await this.privateRoomService.validateTargetUserExists(trimmedContact);
    if (!contactExists) {
      throw new AppError(404, "Contact anonymous user does not exist");
    }

    // Handle clear/reset nickname
    if (rawNickname === null || rawNickname === undefined || rawNickname.trim().length === 0) {
      const updated = await this.repository.upsert(trimmedOwner, trimmedContact, null, null);
      return {
        contactId: trimmedContact,
        displayName: "Anonymous User",
        nickname: null,
        isCustomName: false,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      };
    }

    const trimmedNickname = rawNickname.trim();
    if (trimmedNickname.length > 50) {
      throw new AppError(400, "Nickname cannot exceed 50 characters");
    }

    const cleanedNickname = this.cleanNickname(rawNickname);
    const normalizedNickname = this.normalizeNickname(rawNickname);

    // Check if another contact for the same owner already uses this normalized nickname
    const existing = await this.repository.findByOwnerAndNormalizedNickname(
      trimmedOwner,
      normalizedNickname
    );

    if (existing && existing.contactId !== trimmedContact) {
      throw new AppError(409, "Nickname is already in use for another contact");
    }

    try {
      const updated = await this.repository.upsert(
        trimmedOwner,
        trimmedContact,
        cleanedNickname,
        normalizedNickname
      );

      return {
        contactId: trimmedContact,
        displayName: cleanedNickname,
        nickname: cleanedNickname,
        isCustomName: true,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      };
    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err && err.code === 11000) {
        throw new AppError(409, "Nickname is already in use for another contact");
      }
      throw error;
    }
  }

  async getOwnerContacts(ownerId: string, limit = 50): Promise<ContactIdentityResponse[]> {
    const trimmedOwner = ownerId.trim();
    if (!trimmedOwner) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    const contacts = await this.repository.findByOwner(trimmedOwner, limit);

    return contacts.map((c) => ({
      contactId: c.contactId,
      displayName: c.nickname || "Anonymous User",
      nickname: c.nickname,
      isCustomName: !!c.nickname,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
  }
}
