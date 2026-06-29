import { useState, useCallback } from 'react';
import apiClient from '../api/axios';

export function useComments() {
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);

  const getTemplates = useCallback(async (role) => {
    const params = role ? `?role=${role}` : '';
    const r = await apiClient.get(`/academy/comment-templates/${params}`);
    return r.data;
  }, []);

  const getSystemTemplates = useCallback(async () => {
    const r = await apiClient.get('/academy/comment-templates/system/');
    return r.data;
  }, []);

  const saveTemplate = useCallback(async (data) => {
    const r = await apiClient.post('/academy/comment-templates/', data);
    return r.data;
  }, []);

  const deleteTemplate = useCallback(async (id) => {
    await apiClient.delete(`/academy/comment-templates/${id}/`);
  }, []);

  const generateComments = useCallback(async ({ stream, assessment, role, overwriteManual = false, snapshot }) => {
    setLoading(true); setError(null);
    try {
      const r = await apiClient.post('/academy/comments/generate/', {
        stream, assessment, role, overwrite_manual: overwriteManual,
        ...(snapshot ? { snapshot } : {}),
      });
      return r.data;
    } catch (e) {
      const msg = e.response?.data?.error ?? 'Failed to generate comments.';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getComments = useCallback(async ({ assessment, stream, role, snapshot }) => {
    const p = new URLSearchParams();
    if (snapshot) p.append('snapshot', snapshot);
    else { if (assessment) p.append('assessment', assessment); if (stream) p.append('stream', stream); }
    if (role) p.append('role', role);
    const r = await apiClient.get(`/academy/comments/list/?${p}`);
    return r.data;
  }, []);

  const saveComment = useCallback(async (data) => {
    const payload = { ...data };
    if (!payload.assessment) delete payload.assessment;
    const r = await apiClient.post('/academy/comments/', payload);
    return r.data;
  }, []);

  const updateComment = useCallback(async (id, commentText) => {
    const r = await apiClient.put(`/academy/comments/${id}/`, { comment_text: commentText });
    return r.data;
  }, []);

  const previewComment = useCallback(async ({ student, assessment, role, templateText }) => {
    const r = await apiClient.post('/academy/comments/preview/', {
      student, assessment, role,
      ...(templateText ? { template_text: templateText } : {}),
    });
    return r.data;
  }, []);

  return {
    loading, error,
    getTemplates, getSystemTemplates, saveTemplate, deleteTemplate,
    generateComments, getComments, saveComment, updateComment, previewComment,
  };
}