import axios from 'axios';

const currentOrigin = window.location.origin;

let envApiUrl = import.meta.env.VITE_API_URL || '/api';

if (envApiUrl.includes('localhost') || envApiUrl.includes('127.0.0.1')) {
  envApiUrl = '/api';
}

const API_BASE = `${currentOrigin.replace(/:\d+$/, '')}:4010${envApiUrl}`;
const BACKEND_BASE = API_BASE.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const machineId = localStorage.getItem('report_machine_id');
    if (machineId) {
      config.headers['X-Machine-ID'] = machineId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const apiService = {
  async getVariables() {
    const response = await api.get('/variables');
    return response.data;
  },

  async addVariable(variableData) {
    const response = await api.post('/variables', variableData);
    return response.data;
  },

  async getSignatories() {
    const response = await api.get('/signatories');
    return response.data;
  },

  async getTemplates(userId = null) {
    const params = userId ? { userId } : {};
    const response = await api.get('/templates', { params });
    return response.data;
  },

  async getTemplateById(id) {
    const response = await api.get(`/templates/${id}`);
    return response.data;
  },

  async saveTemplate(templateData) {
    const response = await api.post('/templates', templateData);
    return response.data;
  },

  async updateTemplate(id, templateData) {
    const response = await api.put(`/templates/${id}`, templateData);
    return response.data;
  },

  async deleteTemplate(id) {
    const response = await api.delete(`/templates/${id}`);
    return response.data;
  },

  async cloneTemplate(id) {
    const response = await api.post(`/templates/${id}/clone`);
    return response.data;
  },

  async getReports() {
    const response = await api.get('/reports');
    return response.data;
  },

  async getReportById(id) {
    const response = await api.get(`/reports/${id}`);
    return response.data;
  },

  async createReport(reportData) {
    const response = await api.post('/reports', reportData);
    return response.data;
  },

  async deleteReport(id) {
    const response = await api.delete(`/reports/${id}`);
    return response.data;
  },

  async saveReport(reportData) {
    const response = await api.post('/save-report', reportData);
    return response.data;
  },

  async createReportInstance(reportInstanceData) {
    const response = await api.post('/report-instances', reportInstanceData);
    return response.data;
  },

  async getReportInstances(userId = null) {
    const params = userId ? { userId } : {};
    const response = await api.get('/report-instances', { params });
    return response.data;
  },

  async getReportInstanceById(id) {
    const response = await api.get(`/report-instances/${id}`);
    return response.data;
  },

  async updateReportInstance(id, reportInstanceData) {
    const response = await api.put(`/report-instances/${id}`, reportInstanceData);
    return response.data;
  },

  async deleteReportInstance(id) {
    const response = await api.delete(`/report-instances/${id}`);
    return response.data;
  },

  async getAssets() {
    const response = await api.get('/assets');
    return response.data;
  },

  async uploadAsset(formData) {
    const response = await api.post('/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async deleteAsset(id) {
    const response = await api.delete(`/assets/${id}`);
    return response.data;
  },

  async importPdfFromUrl(url) {
    const response = await api.post('/pdf/import-url', { url });
    return response.data;
  },

  async importPdfLocal(localPath) {
    const response = await api.post('/pdf/import-local', { localPath });
    return response.data;
  },

  async prepareWorkspace(id) {
    const response = await api.get(`/pdf/workspace/${id}`);
    return response.data;
  },

  async savePdfState(formData) {
    const response = await api.post('/pdf/save-state', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async resetToOriginal(id) {
    const response = await api.post(`/pdf/reset/${id}`);
    return response.data;
  },

  async cleanupTemp(id) {
    const response = await api.post(`/pdf/cleanup-temp/${id}`);
    return response.data;
  },

  async checkPdfType(formData) {
    const response = await api.post('/check-pdf-type', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async uploadPdf(formData) {
    const response = await api.post('/pdf/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async downloadBlob(url) {
    const fullUrl = url.startsWith('http') ? url : `${BACKEND_BASE}${url}`;
    const response = await api.get(fullUrl, { responseType: 'blob', baseURL: '' });
    return response.data;
  },

  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  getBackendBase() {
    return BACKEND_BASE;
  }
};

export default apiService;
export { api };
