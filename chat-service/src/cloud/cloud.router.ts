import { Router, Response } from 'express';
import { AppDataSource, CloudFolder, CloudFile } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { IsNull } from 'typeorm';

const router = Router();
const folderRepo = () => AppDataSource.getRepository(CloudFolder);
const fileRepo = () => AppDataSource.getRepository(CloudFile);

// Get user ID headers injected by gateway proxy
const getUserId = (req: any) => req.headers['x-user-id'] as string;

// --- FOLDERS API ---

// 1. Get all folders for a user
router.get('/folders', async (req: any, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized: missing user id' });
    
    const folders = await folderRepo().find({ where: { userId }, order: { name: 'ASC' } });
    res.json({ success: true, data: folders });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// 2. Create folder
router.post('/folders', async (req: any, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Folder name is required' });

    const folder = folderRepo().create({
      id: uuidv4(),
      name,
      userId,
    });
    const saved = await folderRepo().save(folder);
    res.status(201).json({ success: true, data: saved });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// 3. Delete folder
router.delete('/folders/:id', async (req: any, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const folder = await folderRepo().findOne({ where: { id: req.params.id, userId } });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    // Move files in this folder to root or orphan them (set folderId to null)
    await fileRepo().update({ folderId: folder.id }, { folderId: null });
    await folderRepo().remove(folder);
    res.json({ success: true, data: { deleted: true } });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// --- FILES API ---

// 1. Get files for user (optionally inside a folder)
router.get('/files', async (req: any, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const folderId = req.query.folderId === 'root' ? null : (req.query.folderId as string || null);
    
    const files = await fileRepo().find({
      where: { userId, folderId: folderId || undefined },
      order: { createdAt: 'DESC' }
    });
    res.json({ success: true, data: files });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// 2. Register/Upload file metadata
router.post('/files', async (req: any, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, url, mimeType, size, folderId } = req.body;
    if (!name || !url) return res.status(400).json({ message: 'File name and URL are required' });

    // Check for duplicate file name in the same folder
    const existing = await fileRepo().findOne({
      where: { userId, name, folderId: folderId || IsNull() } as any
    });
    if (existing) {
      return res.status(409).json({ message: 'A file with this name already exists in this folder.' });
    }

    const file = fileRepo().create({
      id: uuidv4(),
      name,
      url,
      mimeType,
      size: Number(size || 0),
      folderId: folderId || null,
      userId,
    });
    const saved = await fileRepo().save(file);
    res.status(201).json({ success: true, data: saved });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// 3. Delete file
router.delete('/files/:id', async (req: any, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const file = await fileRepo().findOne({ where: { id: req.params.id, userId } });
    if (!file) return res.status(404).json({ message: 'File not found' });

    await fileRepo().remove(file);
    res.json({ success: true, data: { deleted: true } });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// 4. Update file (e.g. rename)
router.patch('/files/:id', async (req: any, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const file = await fileRepo().findOne({ where: { id: req.params.id, userId } });
    if (!file) return res.status(404).json({ message: 'File not found' });

    const { name } = req.body;
    if (name) {
      // Check for duplicate name in the same folder
      const existing = await fileRepo().findOne({
        where: { userId, name, folderId: file.folderId || IsNull() } as any
      });
      if (existing && existing.id !== file.id) {
        return res.status(409).json({ message: 'A file with this name already exists in this folder.' });
      }
      file.name = name;
    }
    const saved = await fileRepo().save(file);
    res.json({ success: true, data: saved });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
