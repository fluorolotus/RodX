        // Application State
        let nodes = [];
        let lines = [];
        let restrictions = [];
        let nextNodeId = 1;
        let nextElemId = 1; 
		let nodeLoads = [];
        let nextLoadId = 1;
        let elementLoads = [];
        let nextElementLoadId = 1;

        // Results and auxiliary mappings
        let rodResults = [];
        let nodesById = {};

        // Flags for result diagrams
        let showMy = false;
        let showQ = false;
        let showU = false;

        let selectedElements = [];
		
		// --- Глобальные переменные для работы с материалами ---
        let allMaterials = []; // Здесь будут храниться все загруженные материалы
        // Эту переменную будем инициализировать в DOMContentLoaded
        let materialListContainer = null; 
		
		// Глобальные флаги видимости для элементов канваса (НОВОЕ)
                let showNodeIds = true;    // Показывать ID узлов по умолчанию
                let showElementIds = true; // Показывать ID элементов (линий) по умолчанию
                let showBetaAngleIcons = false; // Не показывать иконки угла сечения по умолчанию
                const modelTreeState = {}; // Сохраняет состояние развёрнутых разделов model tree

        let scale = 50; 
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let lastPanX, lastPanY;

        let divisionsPerUnit = parseInt(divisionsInput.value);
        let snapToGrid = true; 
        let currentUnit = unitsSelect.value;
        let currentForceUnit = forceUnitsSelect.value;
        let currentTemperatureUnit = 'C';
        let currentTimeUnit = 's';

        // === Beta Angle Icons ===
        const betaAngleIconSizeWorld = 20; // icon size in pixels
        // Increased offset so the icon does not overlap the line (perpendicular)
        const betaAngleIconOffsetWorld = 0; // perpendicular offset from line in pixels
        // Optional offset along the axis of the line/element
        const betaAngleIconOffsetAlongWorld = 20; // along-axis offset in pixels
        const betaAngleIcons = {
            'C-channel': new Image(),
            'I-beam': new Image(),
            'unknown': new Image()
        };
        betaAngleIcons['C-channel'].src = 'icons/icon_betaAngle_C-channel.svg';
        betaAngleIcons['I-beam'].src = 'icons/icon_betaAngle_I-beam.svg';
        betaAngleIcons['unknown'].src = 'icons/icon_betaAngle_unknownSection.svg';

        const betaIconPositions = {};
        let hoveredBetaIconLine = null;
        
        // Коэффициенты конвертации единиц длины (базовая единица: метры 'm')
        const lengthUnitConversions = { 
            'm': 1,    
            'cm': 0.01,
            'mm': 0.001,
            'in': 0.0254,
            'ft': 0.3048
        };

        // Коэффициенты конвертации единиц силы: сколько Ньютонов в ОДНОЙ единице (базовая единица: Ньютоны 'N')
        const forceUnitConversions = {
            'N':    1,
            'kN':   1000,
            'kg':   9.80665, 
            't':    9806.65, 
            'lbf':  4.44822,
            'kips': 4448.22
        };
		
		// Определения наборов единиц
        const unitPairConversions = {
            'metric_standard': { length: 'm', force: 'kN' },
            'metric_mm_N': { length: 'mm', force: 'N' },
            'imperial_ft_lbf': { length: 'ft', force: 'lbf' },
            'imperial_in_lbf': { length: 'in', force: 'lbf' },
            'imperial_in_kips': { length: 'in', force: 'kips' },
            'metric_kg_m': { length: 'm', force: 'kg' },
            'metric_t_m': { length: 'm', force: 't' }
        };
		
		let currentUnitPair = unitPairsSelect.value;
		
		// Вспомогательная функция для обновления поля "Пары ед."
        function updateUnitPairsSelect() {
            const currentLengthUnit = unitsSelect.value;
            const currentForceUnit = forceUnitsSelect.value;
            
            let foundMatch = false;
            for (const pairKey in unitPairConversions) {
                const pair = unitPairConversions[pairKey];
                if (pair.length === currentLengthUnit && pair.force === currentForceUnit) {
                    unitPairsSelect.value = pairKey;
                    foundMatch = true;
                    break;
                }
            }

            if (!foundMatch) {
                unitPairsSelect.value = 'none'; // Если не найдено соответствие, устанавливаем "Пользовательский"
            }
        }
        
        let firstNodeForLine = null;
        let hoveredElement = null;
        let contextMenuTarget = null;
        let nodeToCopy = null;
        let selectedNode = null;
                let selectedElement = null;

        let mouse = { x: 0, y: 0, worldX: 0, worldY: 0, snappedX: 0, snappedY: 0 }; 

        // Иконки закреплений и их свойства (dx, dy, dr)
        const restrictionTypes = {
            "none":      { dx: 0, dy: 0, dr: 0, icon: null, label: "Нет" },
            "pinned":    { dx: 1, dy: 1, dr: 0, icon: "icon_Pinned.svg", label: "Pinned" },
            "rolled-x":  { dx: 0, dy: 1, dr: 0, icon: "icon_Rolled-X.svg", label: "Roller-X" },
            "rolled-y":  { dx: 1, dy: 0, dr: 0, icon: "icon_Rolled-Y.svg", label: "Roller-Y" },
            "fixed":     { dx: 1, dy: 1, dr: 1, icon: "icon_Fixed.svg", label: "Fixed" },
            "sleeve-x":  { dx: 0, dy: 1, dr: 1, icon: "icon_Sleeve-X.svg", label: "Slider-X" },
            "sleeve-y":  { dx: 1, dy: 0, dr: 1, icon: "icon_Sleeve-Y.svg", label: "Slider-Y" }
        };

        // Функция для сохранения модели в JSON

