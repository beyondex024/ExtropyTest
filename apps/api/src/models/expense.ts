import mongoose, { Schema, type Model } from "mongoose";

const ExpenseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

ExpenseSchema.index({ userId: 1, date: -1 });

export type ExpenseDoc = mongoose.InferSchemaType<typeof ExpenseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ExpenseModel: Model<ExpenseDoc> =
  (mongoose.models.Expense as Model<ExpenseDoc> | undefined) ??
  mongoose.model<ExpenseDoc>("Expense", ExpenseSchema);
