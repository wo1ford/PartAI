<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import FileUpload from 'primevue/fileupload'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import type { FileUploadSelectEvent } from 'primevue/fileupload'

const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  (e: 'graph-built', graphData: any): void
}>()

const toast = useToast()

// ===== ШАГИ =====
const currentStep = ref(1) // 1 - Загрузка, 2 - Настройка графика

// ===== ДАННЫЕ ЗАГРУЖЕННОГО ФАЙЛА =====
const rawData = ref<{ label: string; value: number }[]>([])
const importedFileName = ref('')
const isParsing = ref(false)

// ===== НАСТРОЙКИ ГРАФИКА =====
const graphTitle = ref('Загруженный график')
const chartType = ref('bar') // bar, line, pie, doughnut, polarArea
const xAxisLabel = ref('Категория')
const yAxisLabel = ref('Значение')

// ===== ОБРАБОТКА ЗАГРУЗКИ XLSX =====
const onFileSelect = async (event: FileUploadSelectEvent) => {
  const files = event.files
  if (!files || files.length === 0) return

  const file = files[0]
  importedFileName.value = file.name
  
  // Проверяем расширение
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Пожалуйста, загрузите файл формата .xlsx или .xls', life: 4000 })
    return
  }

  isParsing.value = true
  try {
    // Динамический импорт xlsx
    const XLSX = await import('xlsx')
    const reader = new FileReader()
    
    const data = await new Promise((resolve, reject) => {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet)
          resolve(jsonData)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    }) as any[]

    // Валидация данных: Ищем первый столбец как категорию, второй как значение
    if (data.length === 0) {
      toast.add({ severity: 'error', summary: 'Ошибка формата', detail: 'Файл пуст или содержит некорректные данные', life: 5000 })
      isParsing.value = false
      return
    }

    const headers = Object.keys(data[0])
    if (headers.length < 2) {
      toast.add({ severity: 'error', summary: 'Ошибка формата', detail: 'Таблица должна содержать минимум 2 столбца: Признак и Значение', life: 5000 })
      isParsing.value = false
      return
    }

    // Первый столбец - Категория/Признак. Второй столбец - Значение.
    rawData.value = data.map((row: any) => ({
      label: String(row[headers[0]]),
      value: Number(row[headers[1]])
    }))

    // Если всё ок — переходим на шаг 2 (Настройки)
    toast.add({ severity: 'success', summary: 'Файл загружен', detail: `Найдено ${rawData.value.length} записей`, life: 3000 })
    currentStep.value = 2
    
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось прочитать файл. Проверьте его структуру.', life: 5000 })
  } finally {
    isParsing.value = false
  }
}

// ===== ПОСТРОЕНИЕ ГРАФИКА =====
const buildGraph = () => {
  if (rawData.value.length === 0) {
    toast.add({ severity: 'warn', summary: 'Нет данных', detail: 'Сначала загрузите файл', life: 3000 })
    return
  }

  // Формируем объект для передачи в дашборд
  const graphData = {
    title: graphTitle.value || 'График',
    type: chartType.value,
    labels: rawData.value.map(d => d.label),
    values: rawData.value.map(d => d.value),
    xLabel: xAxisLabel.value,
    yLabel: yAxisLabel.value,
    rawData: rawData.value
  }

  emit('graph-built', graphData)
  visible.value = false
  resetState()
}

// ===== СБРОС =====
const resetState = () => {
  currentStep.value = 1
  rawData.value = []
  importedFileName.value = ''
  graphTitle.value = 'Загруженный график'
  chartType.value = 'bar'
  xAxisLabel.value = 'Категория'
  yAxisLabel.value = 'Значение'
}

const closeModal = () => {
  visible.value = false
  resetState()
}

// ===== ПРЕДПРОСМОТР ДАННЫХ =====
const previewData = computed(() => rawData.value.slice(0, 5))
</script>

<template>
  <Dialog 
    v-model:visible="visible" 
    modal 
    :header="currentStep === 1 ? 'Импорт данных для графика' : 'Настройка графика'" 
    :style="{ width: '700px', maxWidth: '95vw' }"
    class="import-dialog"
    @update:visible="(val) => !val && closeModal()"
  >
    
    <!-- ================= ШАГ 1: ЗАГРУЗКА ================= -->
    <div v-if="currentStep === 1" class="step-container step-1">
      
      <!-- Анимированный блок инструкции -->
      <div class="instruction-box">
        <div class="instruction-icon"><i class="pi pi-info-circle"></i></div>
        <div class="instruction-content">
          <h4>Как должен выглядеть ваш Excel-файл</h4>
          <p>Для корректного построения графика ваша таблица должна содержать 2 столбца:</p>
          <div class="table-mockup">
            <div class="mock-header"><span>Признак</span><span>Значение</span></div>
            <div class="mock-row"><span>Продажи</span><span>120</span></div>
            <div class="mock-row"><span>Маркетинг</span><span>150</span></div>
            <div class="mock-row"><span>Разработка</span><span>90</span></div>
          </div>
          <p class="small-note">* В первом столбце могут быть любые названия, имена или категории.</p>
        </div>
      </div>

      <!-- Зона загрузки -->
      <div class="upload-area">
        <div class="icon-wrapper"><i class="pi pi-file-excel" style="color: #1abc9c;"></i></div>
        <div class="upload-message">
          <h4>Перетащите .xlsx или .xls файл</h4>
          <p>или нажмите кнопку ниже, чтобы выбрать файл</p>
        </div>
        <FileUpload
          mode="basic"
          accept=".xlsx,.xls"
          :max-file-size="50000000"
          custom-upload
          choose-label="Выбрать файл Excel"
          class="custom-upload-btn"
          @select="onFileSelect"
          :auto="true"
          :loading="isParsing"
        />
        <div v-if="isParsing" class="parsing-indicator">
          <i class="pi pi-spin pi-spinner"></i> Чтение данных...
        </div>
      </div>
      
    </div>

    <!-- ================= ШАГ 2: НАСТРОЙКА ГРАФИКА ================= -->
    <div v-else-if="currentStep === 2" class="step-container step-2">
      
      <div class="two-column-layout">
        <!-- Левая колонка: Настройки -->
        <div class="settings-column">
          <div class="form-group">
            <label>Название графика</label>
            <InputText v-model="graphTitle" placeholder="Например: Динамика показателей" fluid />
          </div>
          
          <div class="form-group">
            <label>Тип диаграммы</label>
            <Select 
              v-model="chartType" 
              :options="[
                { label: 'Столбчатая (Bar)', value: 'bar' },
                { label: 'Линейная (Line)', value: 'line' },
                { label: 'Круговая (Pie)', value: 'pie' },
                { label: 'Кольцевая (Doughnut)', value: 'doughnut' },
                { label: 'Лепестковая (Radar)', value: 'radar' }
              ]" 
              optionLabel="label" 
              optionValue="value"
              placeholder="Выберите тип"
              fluid
            />
          </div>

          <div class="form-group">
            <label>Подпись горизонтальной оси (X)</label>
            <InputText v-model="xAxisLabel" placeholder="Например: Категории" fluid />
          </div>
          
          <div class="form-group">
            <label>Подпись вертикальной оси (Y)</label>
            <InputText v-model="yAxisLabel" placeholder="Например: Количество" fluid />
          </div>

          <div class="form-group data-preview">
            <label>Предпросмотр данных (первые 5 строк)</label>
            <div class="mini-table">
              <div class="mini-header"><span>Признак</span><span>Знач.</span></div>
              <div v-for="(row, idx) in previewData" :key="idx" class="mini-row">
                <span>{{ row.label }}</span>
                <span>{{ row.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Правая колонка: Превью графика -->
        <div class="preview-column">
          <div class="preview-container">
            <h4>Превью</h4>
            <div class="chart-preview-placeholder">
              <i class="pi pi-chart-bar" style="font-size: 48px; color: #1abc9c; opacity: 0.5;"></i>
              <p>После нажатия кнопки "Построить"</p>
              <p style="font-size: 12px; color: #94a3b8;">График появится на вашем дашборде</p>
            </div>
            
            <div class="preview-stats">
              <div class="stat-item"><span>Строк данных:</span> <strong>{{ rawData.length }}</strong></div>
              <div class="stat-item"><span>Макс. значение:</span> <strong>{{ Math.max(...rawData.map(d => d.value)) }}</strong></div>
              <div class="stat-item"><span>Мин. значение:</span> <strong>{{ Math.min(...rawData.map(d => d.value)) }}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-actions">
        <Button v-if="currentStep === 1" label="Отмена" text @click="closeModal" />
        <Button v-if="currentStep === 2" label="Назад" text @click="currentStep = 1" />
        <Button v-if="currentStep === 2" label="Построить график" severity="success" icon="pi pi-chart-line" @click="buildGraph" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* ===== СТРУКТУРА ШАГОВ ===== */
.step-container { display: flex; flex-direction: column; gap: 20px; padding: 8px 0; min-height: 300px; }
.step-2 { min-height: 450px; }

/* ===== ИНСТРУКЦИЯ (ШАГ 1) ===== */
.instruction-box {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-left: 4px solid #1abc9c;
  border-radius: 8px;
  animation: slideInLeft 0.5s ease-out forwards;
}
@keyframes slideInLeft {
  0% { transform: translateX(-15px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
.instruction-icon {
  font-size: 24px;
  color: #1abc9c;
}
.instruction-content h4 { margin: 0 0 8px 0; font-size: 15px; color: #1e293b; }
.instruction-content p { margin: 0 0 12px 0; font-size: 14px; color: #475569; }
.table-mockup {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  font-size: 13px;
  margin-bottom: 8px;
  width: 180px;
}
.mock-header { display: flex; background: #f1f5f9; padding: 6px 12px; font-weight: 600; justify-content: space-between; border-bottom: 1px solid #e2e8f0; }
.mock-row { display: flex; padding: 4px 12px; justify-content: space-between; background: #fff; }
.mock-row:nth-child(2) { border-bottom: 1px solid #f1f5f9; }
.small-note { font-size: 12px !important; color: #94a3b8 !important; margin: 0 !important; }

/* ===== ЗОНА ЗАГРУЗКИ ===== */
.upload-area {
  border: 2px dashed #dce1e6;
  border-radius: 16px;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: #fafbfc;
  transition: all 0.2s ease;
}
.upload-area:hover { border-color: #1abc9c; background: #f2fefb; }
.icon-wrapper {
  width: 48px; height: 48px;
  background: #f0fdfa; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
}
.upload-message { text-align: center; }
.upload-message h4 { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1e293b; }
.upload-message p { margin: 0; font-size: 13px; color: #94a3b8; }

:deep(.custom-upload-btn .p-button) {
  background: #ffffff !important; border: 1px solid #e2e8f0 !important;
  color: #475569 !important; border-radius: 8px !important;
  padding: 8px 20px !important; transition: all 0.2s ease;
}
:deep(.custom-upload-btn .p-button:hover) {
  border-color: #1abc9c !important; color: #1abc9c !important;
  background: #f8fafc !important;
}
.parsing-indicator {
  margin-top: 8px; color: #1abc9c; font-size: 14px; display: flex; gap: 6px; align-items: center;
}

/* ===== ДВУХКОЛОНОЧНЫЙ МАКЕТ (ШАГ 2) ===== */
.two-column-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.settings-column { display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 12px; font-weight: 600; color: #64748b; }

/* Превью данных */
.data-preview { margin-top: 6px; }
.mini-table { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; font-size: 13px; }
.mini-header { display: flex; background: #f8fafc; padding: 6px 10px; font-weight: 600; border-bottom: 1px solid #e2e8f0; justify-content: space-between; }
.mini-row { display: flex; justify-content: space-between; padding: 4px 10px; border-bottom: 1px solid #f1f5f9; }
.mini-row:last-child { border-bottom: none; }

/* Превью графика */
.preview-column { display: flex; flex-direction: column; }
.preview-container {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; gap: 12px;
}
.preview-container h4 { margin: 0; font-size: 14px; font-weight: 600; color: #475569; align-self: flex-start; }
.chart-preview-placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.preview-stats { width: 100%; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.stat-item { display: flex; justify-content: space-between; font-size: 13px; color: #475569; }

/* Footer */
.footer-actions { display: flex; justify-content: space-between; width: 100%; gap: 10px; }

/* Анимация появления диалога */
:deep(.p-dialog) { animation: slideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
@keyframes slideIn { 0% { transform: translateY(20px) scale(0.98); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }

/* Адаптивность */
@media (max-width: 640px) {
  .two-column-layout { grid-template-columns: 1fr; }
  .step-2 { min-height: auto; }
}
</style>