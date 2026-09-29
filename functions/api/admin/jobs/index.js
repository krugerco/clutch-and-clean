import { collection } from '../../../../lib/api.js';
import { afterJobSave } from '../../../../lib/jobs.js';

export const { onRequestGet, onRequestPost } = collection('jobs', { afterInsert: afterJobSave });
