        // DOM Elements
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');
        const canvasContainer = document.getElementById('canvasContainer');
        
        // Элементы панелей управления
        const divisionsInput = document.getElementById('divisions');
        const snapToGridCheckbox = document.getElementById('snapToGrid');
        const clearCanvasBtn = document.getElementById('clearCanvasBtn');
        const unitsSelect = document.getElementById('unitsSelect'); // ID изменен
        const forceUnitsSelect = document.getElementById('forceUnitsSelect'); // ID изменен
        const unitPairsSelect = document.getElementById('unitPairsSelect'); // ID изменен
        const saveModelBtn = document.getElementById('saveModelBtn');
        const loadModelBtn = document.getElementById('loadModelBtn');
        const fileInput = document.getElementById('fileInput');
        const importMenuItem = document.getElementById('importMenuItem');
        const exportMenuItem = document.getElementById('exportMenuItem');
        const shareMenu = document.getElementById('shareMenu');
        const resultsUploadMenuItem = document.getElementById('resultsUploadMenuItem');
        const resultsMyMenuItem = document.getElementById('resultsMyMenuItem');
        const resultsQzMenuItem = document.getElementById('resultsQzMenuItem');
        const resultsUxyMenuItem = document.getElementById('resultsUxyMenuItem');
        const resultsFileInput = document.getElementById('resultsFileInput');

        const tooltip = document.getElementById('tooltip');
        const cursorTooltip = document.getElementById('cursorTooltip');
        const customContextMenu = document.getElementById('customContextMenu');
        const deleteNodeItem = document.getElementById('deleteNodeItem');
        const deleteLineItem = document.getElementById('deleteLineItem');
        const copyNodeItem = document.getElementById('copyNodeItem');
        const copyNodeModal = document.getElementById('copyNodeModal');
        const copyAxisSelect = document.getElementById('copyAxisSelect');
        const copyCountInput = document.getElementById('copyCountInput');
        const copyDistanceInput = document.getElementById('copyDistanceInput');
        const applyCopyNodeBtn = document.getElementById('applyCopyNodeBtn');
        
        // Элементы propertiesPanel
const propertiesPanel = document.getElementById('propertiesPanel');
const nodePropertiesContent = document.getElementById('nodePropertiesContent');
const modelTreePanel = document.getElementById('modelTreePanel');
const modelTreeContent = document.getElementById('modelTreeContent');
        
