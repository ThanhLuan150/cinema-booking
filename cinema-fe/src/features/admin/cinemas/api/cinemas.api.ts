import apiClient from 'services/apiClient';

export const approveCinema = (id: number | string) => apiClient.put(`/cinema/${id}/approve`);

export const blockCinema = (id: number | string) => apiClient.put(`/cinema/${id}/block`);

export const deleteCinema = (id: number | string) => apiClient.delete(`/cinema/${id}`);
