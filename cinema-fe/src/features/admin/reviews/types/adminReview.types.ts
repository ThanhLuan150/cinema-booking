export type ReviewStatus = 'VISIBLE' | 'HIDDEN' | 'REJECTED';

export interface AdminReview {
  id: number;
  rating: number;
  comment: string;
  status: ReviewStatus;
  movie?: { name: string };
  cinema?: { name: string };
  reportCount?: number;
}
