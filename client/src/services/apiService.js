import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
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

  async saveReport(reportData) {
    const response = await api.post('/save-report', reportData);
    return response.data;
  },

  async getReportById(id) {
    const response = await api.get(`/reports/${id}`);
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

  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  importPdfFromUrl: async (url) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    return await axios.post(`${apiUrl}/pdf/import-url`, { url });
  },
};

export default apiService;
export { api };
