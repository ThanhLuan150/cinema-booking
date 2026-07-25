export interface AdminReview {
  id: number;
  rating: number;
  comment: string;
  hidden: boolean;
  movie?: { name: string };
  cinema?: { name: string };
}
