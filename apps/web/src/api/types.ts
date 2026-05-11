export type Category = { id: string; name: string; isDefault: boolean };

export type Expense = {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: Category;
};
