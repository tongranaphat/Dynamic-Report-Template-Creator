import { ref } from 'vue';

export function usePreviewData() {
  const defaultMockData = {
    school_name: 'โรงเรียนเวทย์มนตร์',
    school_year: '2580',
    student_name: 'ด.ช. แฮรี่ พอตเตอร์',
    student_id: '80001',
    gpa: '5.00',
    class_level: 'ม.7/1',
    teacher_name: 'ครูสเนป โหด',
    comment: 'เก่งมาก',
    date: new Date().toLocaleDateString('th-TH')
  };

  const customMockData = ref({});

  const getMockData = () => {
    return { ...defaultMockData, ...customMockData.value };
  };

  const setMockData = (data) => {
    customMockData.value = { ...data };
  };

  const updateMockData = (key, value) => {
    customMockData.value[key] = value;
  };

  return {
    getMockData,
    setMockData,
    updateMockData,
    customMockData
  };
}
