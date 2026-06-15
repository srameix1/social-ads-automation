import { Router } from 'express';

const router = Router({ mergeParams: true });

// Strategy selection moved to /api/posts/:postId/select-copy

export default router;
