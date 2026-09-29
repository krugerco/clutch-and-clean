import { item } from '../../../../lib/api.js';
import { afterJobSave } from '../../../../lib/jobs.js';

export const { onRequestGet, onRequestPatch, onRequestDelete } = item('jobs', { afterUpdate: afterJobSave });
