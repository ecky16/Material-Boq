export interface LOP {
  id: string;
  user_id: string;
  name: string;
  date: string;
  created_at: string;
  username: string;
  inputer_name: string;
}

export interface LOPItem {
  id: string;
  lop_id: string;
  designator: string;
  volume: number;
}

export interface LOPWithItems extends LOP {
  items: LOPItem[];
}

export interface AppUser {
  id: string;
  username: string;
  password_hash: string;
  inputer_name: string;
  role: 'admin' | 'user';
}
