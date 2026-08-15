import { Types } from "mongoose";
import { PrivateContactModel } from "./private-contact.model.js";
import type { IPrivateContact, IPrivateContactDoc } from "./private-contact.types.js";

export class PrivateContactRepository {
  private formatContact(doc: {
    _id: Types.ObjectId | string;
    ownerId: string;
    contactId: string;
    nickname: string | null;
    normalizedNickname: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): IPrivateContact {
    const id = doc._id.toString();
    return {
      id,
      _id: id,
      ownerId: doc.ownerId,
      contactId: doc.contactId,
      nickname: doc.nickname,
      normalizedNickname: doc.normalizedNickname,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt)
    };
  }

  async findByOwnerAndContact(
    ownerId: string,
    contactId: string
  ): Promise<IPrivateContact | null> {
    const doc = await PrivateContactModel.findOne({
      ownerId,
      contactId
    }).lean<IPrivateContactDoc | null>();

    if (!doc) return null;
    return this.formatContact(doc);
  }

  async findByOwnerAndNormalizedNickname(
    ownerId: string,
    normalizedNickname: string
  ): Promise<IPrivateContact | null> {
    const doc = await PrivateContactModel.findOne({
      ownerId,
      normalizedNickname
    }).lean<IPrivateContactDoc | null>();

    if (!doc) return null;
    return this.formatContact(doc);
  }

  async upsert(
    ownerId: string,
    contactId: string,
    nickname: string | null,
    normalizedNickname: string | null
  ): Promise<IPrivateContact> {
    const filter = { ownerId, contactId };
    const update = {
      $set: {
        nickname,
        normalizedNickname
      }
    };
    const options = {
      upsert: true,
      new: true,
      runValidators: true
    };

    const doc = await PrivateContactModel.findOneAndUpdate(
      filter,
      update,
      options
    ).lean<IPrivateContactDoc | null>();

    if (!doc) {
      throw new Error("Failed to upsert private contact record");
    }

    return this.formatContact(doc);
  }

  async findByOwner(ownerId: string, limit = 50): Promise<IPrivateContact[]> {
    const docs = await PrivateContactModel.find({ ownerId })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
      .lean<IPrivateContactDoc[]>();

    return docs.map((doc) => this.formatContact(doc));
  }
}
