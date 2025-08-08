        function saveModel() {
            const modelData = {
                nodes: nodes,
                lines: lines,
                restrictions: restrictions,
                nodeLoads: nodeLoads,
                elementLoads: elementLoads,
                materials: modelMaterials,
                sections: modelSections,
                units: {
                    length: currentUnit,
                    force: currentForceUnit,
                    temperature: currentTemperatureUnit,
                    time: currentTimeUnit
                }
            };
            
            console.log("Модель данных перед сохранением:", modelData);
            console.log("Единицы измерения в модели:", modelData.units);

            const jsonString = JSON.stringify(modelData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log("Модель сохранена в model.json");
        }

                async function loadModel(jsonFileContent) {
            try {
                const modelData = JSON.parse(jsonFileContent);

                nodes = modelData.nodes || [];
                lines = (modelData.lines || []).map(l => ({
                    ...l,
                    sectionId: l.sectionId !== undefined ? l.sectionId : null,
                    betaAngle: l.betaAngle !== undefined ? l.betaAngle : 0
                }));
                restrictions = modelData.restrictions || [];
                nodeLoads = modelData.nodeLoads || [];
                elementLoads = modelData.elementLoads || [];
				
				// НОВОЕ: Загружаем материалы модели
                modelMaterials = modelData.materials || [];
                renderModelMaterialsList();
                modelSections = modelData.sections || [];
                renderModelSectionsList();

                if (modelData.units) {
                    const loadedLengthUnit = modelData.units.length;
                    const loadedForceUnit = modelData.units.force;
                    const loadedTemperatureUnit = modelData.units.temperature || 'C';
                    const loadedTimeUnit = modelData.units.time || 's';

                    currentTemperatureUnit = loadedTemperatureUnit;
                    currentTimeUnit = loadedTimeUnit;

                    if (unitsSelect.value !== loadedLengthUnit) {
                        unitsSelect.value = loadedLengthUnit;
                        unitsSelect.dispatchEvent(new Event('change'));
                    } else {
                        currentUnit = loadedLengthUnit;
                        updateUnitPairsSelect();
                        updateForceUnitDisplay();
                    }

                    if (forceUnitsSelect.value !== loadedForceUnit) {
                        forceUnitsSelect.value = loadedForceUnit;
                        forceUnitsSelect.dataset.previousValue = loadedForceUnit;
                        forceUnitsSelect.dispatchEvent(new Event('change'));
                    } else {
                        currentForceUnit = loadedForceUnit;
                        updateUnitPairsSelect();
                        updateForceUnitDisplay();
                    }

                } else {
                    currentTemperatureUnit = 'C';
                    currentTimeUnit = 's';
                }

                nextNodeId = nodes.length > 0 ? Math.max(...nodes.map(n => n.node_id)) + 1 : 1;
                nextElemId = lines.length > 0 ? Math.max(...lines.map(l => l.elem_id)) + 1 : 1;
                nextLoadId = nodeLoads.length > 0 ? Math.max(...nodeLoads.map(l => l.load_id)) + 1 : 1;
                nextElementLoadId = elementLoads.length > 0 ? Math.max(...elementLoads.map(l => l.load_id)) + 1 : 1;

                selectedNode = null;
                selectedElement = null;
                firstNodeForLine = null;

                if ((modelData.units && unitsSelect.value === modelData.units.length && forceUnitsSelect.value === modelData.units.force) || !modelData.units) {
                    updatePropertiesPanel();
                    draw();
                }

                console.log("Модель успешно загружена.");
            } catch (error) {
                console.error("Ошибка при загрузке модели:", error);
                console.error("Не удалось загрузить модель. Проверьте формат файла.");
            }
        }

        async function loadResults(jsonFileContent) {
            try {
                const data = JSON.parse(jsonFileContent);
                resultsData = data.results || data;
                reactionsData = data.reactions || [];
                activeDiagram = null;
                showReactions = false;
                draw();
                console.log("Результаты успешно загружены.");
            } catch (error) {
                console.error("Ошибка при загрузке результатов:", error);
            }
        }
		
		function toggleMaterialsModal() {
			materialsModal.classList.toggle('hidden');
		}

        function init() {
            addEventListeners();
            snapToGridCheckbox.checked = snapToGrid;
            resizeCanvas();

            forceUnitsSelect.value = 'kN';
            forceUnitsSelect.dataset.previousValue = 'kN';

            unitsSelect.value = 'm';
            currentUnit = unitsSelect.value;
            currentForceUnit = forceUnitsSelect.value;
            unitsSelect.dispatchEvent(new Event('change'));

            updateUnitPairsSelect();
            updateForceUnitDisplay();
        }

        function resizeCanvas() {
            canvas.width = canvasContainer.clientWidth;
            canvas.height = canvasContainer.clientHeight;
            panX = canvas.width / 2;
            panY = canvas.height / 2;
            draw();
            adjustPropertiesPanelHeight();
        }

        function adjustPropertiesPanelHeight() {
            const H = window.innerHeight;
            const T = 60; // высота верхней панели инструментов
            const B = 33; // высота нижней панели
            const panelHeight = (H - T - B - 30) / 2;
            const panel = document.getElementById('propertiesPanel');
            if (panelHeight > 0 && panel) {
                panel.style.height = `${panelHeight}px`;
                panel.style.bottom = '43px';
            }
            const modelPanel = document.getElementById('modelTreePanel');
            if (panelHeight > 0 && modelPanel) {
                modelPanel.style.height = `${panelHeight}px`;
                if (panel) {
                    modelPanel.style.bottom = `${43 + panelHeight + 10}px`;
                    modelPanel.style.width = panel.style.width || `${panel.offsetWidth}px`;
                } else {
                    modelPanel.style.bottom = `${43 + panelHeight + 10}px`;
                }
            }
        }

        function renderModelTree() {
            const container = document.getElementById('modelTreeContent');
            if (!container) return;
            container.innerHTML = '';

            const treeRoot = document.createElement('ul');

            function addSection(key, title, children, expandable) {
                const li = document.createElement('li');
                const item = document.createElement('div');
                item.className = 'tree-item';

                let arrow;
                if (expandable) {
                    arrow = document.createElement('span');
                    arrow.className = 'tree-arrow';
                    item.appendChild(arrow);
                } else {
                    arrow = document.createElement('span');
                    arrow.className = 'tree-arrow invisible';
                    item.appendChild(arrow);
                }

                const text = document.createElement('span');
                text.textContent = title;
                item.appendChild(text);
                li.appendChild(item);

                if (expandable) {
                    const childList = document.createElement('ul');
                    const isExpanded = modelTreeState[key];
                    if (!isExpanded) {
                        childList.classList.add('hidden');
                    } else {
                        arrow.classList.add('down');
                    }
                    children.forEach(child => {
                        const childLi = document.createElement('li');
                        childLi.textContent = child;
                        childList.appendChild(childLi);
                    });
                    li.appendChild(childList);

                    item.addEventListener('click', () => {
                        const isHidden = childList.classList.toggle('hidden');
                        arrow.classList.toggle('down');
                        modelTreeState[key] = !isHidden;
                    });
                }

                treeRoot.appendChild(li);
            }

            const structuresChildren = [];
            if (nodes.length > 0) structuresChildren.push(`Nodes: ${nodes.length}`);
            if (lines.length > 0) structuresChildren.push(`Rods: ${lines.length}`);
            const structuresExpandable = structuresChildren.length > 0;
            addSection('structures', 'Structures', structuresChildren, structuresExpandable);

            const materialsChildren = modelMaterials.map((mat, index) => `${index + 1}: ${mat.name}`);
            addSection('materials', `Materials: ${modelMaterials.length}`, materialsChildren, modelMaterials.length > 0);

            const sectionsChildren = modelSections.map((sec, index) => `${index + 1}: ${sec.name}`);
            addSection('sections', `Sections: ${modelSections.length}`, sectionsChildren, modelSections.length > 0);

            const supportTypes = [
                { name: 'Fixed', dx: 1, dy: 1, dr: 1 },
                { name: 'Pinned', dx: 1, dy: 1, dr: 0 },
                { name: 'Roller-X', dx: 0, dy: 1, dr: 0 },
                { name: 'Roller-Y', dx: 1, dy: 0, dr: 0 },
                { name: 'Slider-X', dx: 0, dy: 1, dr: 1 },
                { name: 'Slider-Y', dx: 1, dy: 0, dr: 1 }
            ];
            const supportCounts = {};
            supportTypes.forEach(type => {
                supportCounts[type.name] = restrictions.filter(r => r.dx === type.dx && r.dy === type.dy && r.dr === type.dr).length;
            });
            const supportsTotal = Object.values(supportCounts).reduce((a, b) => a + b, 0);
            const supportsChildren = supportTypes
                .filter(type => supportCounts[type.name] > 0)
                .map(type => `${type.name}: ${supportCounts[type.name]}`);
            addSection('supports', `Supports: ${supportsTotal}`, supportsChildren, supportsTotal > 0);

            const pointLoads = nodeLoads.filter(l => l.type === 'point_force').length;
            const moments = nodeLoads.filter(l => l.type === 'moment').length;
            const beamLoads = elementLoads.length;
            const loadsChildren = [];
            if (pointLoads > 0) loadsChildren.push(`Point load: ${pointLoads}`);
            if (moments > 0) loadsChildren.push(`Moment: ${moments}`);
            if (beamLoads > 0) loadsChildren.push(`Beam Load: ${beamLoads}`);
            const loadsTotal = pointLoads + moments + beamLoads;
            addSection('loads', 'Loads', loadsChildren, loadsTotal > 0);

            container.appendChild(treeRoot);
        }

        // Coordinate Transformations (world coords are in currentUnit, positive Y is UP)
        function screenToWorld(screenX, screenY) {
            return {
                x: (screenX - panX) / scale,
                y: -(screenY - panY) / scale 
            };
        }

        function worldToScreen(worldX, worldY) { 
            return {
                x: worldX * scale + panX,
                y: worldY * (-scale) + panY 
            };
        }
        
        // Snapping Logic (snaps to sub-grid of currentUnit)
        function getSnappedCoordinates(worldX_currentUnit, worldY_currentUnit) { 
            if (!snapToGrid) return { x: worldX_currentUnit, y: worldY_currentUnit };
            const gridSize_currentUnit = 1 / divisionsPerUnit;
            return {
                x: Math.round(worldX_currentUnit / gridSize_currentUnit) * gridSize_currentUnit,
                y: Math.round(worldY_currentUnit / gridSize_currentUnit) * gridSize_currentUnit
            };
        }
        
        // Unit Conversion Helper (для длины)
        function convertUnits(value, fromUnit, toUnit) {
            if (fromUnit === toUnit) return value;
            if (!lengthUnitConversions[fromUnit] || !lengthUnitConversions[toUnit]) {
                console.warn(`Неизвестные единицы длины: ${fromUnit} или ${toUnit}`);
                return value;
            }
            // Сначала конвертируем в метры (базовая единица для длины)
            const valueInMeters = value * lengthUnitConversions[fromUnit];
            // Затем конвертируем из метров в целевую единицу
            return valueInMeters / lengthUnitConversions[toUnit];
        }

        // Новая универсальная функция конвертации силы
        // Конвертирует 'value' из 'fromUnit' в 'toUnit'
        function convertForce(value, fromUnit, toUnit) {
            if (fromUnit === toUnit || !forceUnitConversions[fromUnit] || !forceUnitConversions[toUnit]) {
                return value;
            }
            const valueInNewtons = value * forceUnitConversions[fromUnit];
            return valueInNewtons / forceUnitConversions[toUnit];
        }

        // НОВАЯ ФУНКЦИЯ: Универсальная функция конвертации моментов
        function convertMoment(value, fromForceUnit, fromLengthUnit, toForceUnit, toLengthUnit) {
            if (!forceUnitConversions[fromForceUnit] || !forceUnitConversions[toForceUnit] ||
                !lengthUnitConversions[fromLengthUnit] || !lengthUnitConversions[toLengthUnit]) {
                console.warn("Неизвестные единицы для конвертации момента.");
                return value;
            }

            const momentInNewtonMeters = value * forceUnitConversions[fromForceUnit] * lengthUnitConversions[fromLengthUnit];
            const convertedValue = momentInNewtonMeters / (forceUnitConversions[toForceUnit] * lengthUnitConversions[toLengthUnit]);
            
            return convertedValue;
        }
		
		// НОВАЯ ФУНКЦИЯ: Универсальная функция конвертации распределенных нагрузок (F/L)
        function convertDistributedForce(value, fromForceUnit, fromLengthUnit, toForceUnit, toLengthUnit) {
            if (!forceUnitConversions[fromForceUnit] || !forceUnitConversions[toForceUnit] ||
                !lengthUnitConversions[fromLengthUnit] || !lengthUnitConversions[toLengthUnit]) {
                console.warn(`Неизвестные единицы для конвертации распределенной нагрузки: ${fromForceUnit}/${fromLengthUnit} -> ${toForceUnit}/${toLengthUnit}`);
                return value;
            }

            const valueInNewtonsPerMeter = (value * forceUnitConversions[fromForceUnit]) / lengthUnitConversions[fromLengthUnit];
            const convertedValue = valueInNewtonsPerMeter / (forceUnitConversions[toForceUnit] / lengthUnitConversions[toLengthUnit]);
            
            return convertedValue;
        }

        // Вспомогательная функция для получения текста единицы измерения
        // Возвращает единицу измерения, если она не 'none', иначе пустую строку.
        function getUnitText(unit) {
            return (unit && unit !== 'none') ? unit : '';
        }

        // Обновляет текстовые спаны с единицами измерения на панели свойств
        function updateForceUnitDisplay() {
            const selectedUnit = forceUnitsSelect.value; 
            const selectedMomentUnit = selectedUnit + '*' + unitsSelect.value;

            const displayFx = document.getElementById('currentForceUnitDisplay_Fx');
            const displayFy = document.getElementById('currentForceUnitDisplay_Fy');
            const displayM = document.getElementById('currentForceUnitDisplay_M');
            const displayqX = document.getElementById('currentDistributedForceUnitDisplay_qX'); // For distributed loads
            const displayqY = document.getElementById('currentDistributedForceUnitDisplay_qY'); // For distributed loads

            if (displayFx) displayFx.textContent = selectedUnit;
            if (displayFy) displayFy.textContent = selectedUnit;
            if (displayM) displayM.textContent = selectedMomentUnit;
            if (displayqX) displayqX.textContent = `${selectedUnit}/${unitsSelect.value}`; // For distributed loads
            if (displayqY) displayqY.textContent = `${selectedUnit}/${unitsSelect.value}`; // For distributed loads
            
            updatePropertiesPanel(); 
            draw();
        }
		
		// Drawing Functions
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(panX, panY);
            ctx.scale(scale, -scale); // Важно: Y-ось инвертирована здесь!

            drawGrid();
            drawAxes();
            if (showLoads) {
                        drawDistributedLoads();
            }
            drawLines();
            drawResults();
            drawRestrictions();
            drawNodes();

            if (showLoads) {
            drawNodeLoads();
            }

            if (showReactions) {
            drawReactions();
            }


            ctx.restore(); // Восстанавливаем исходную матрицу трансформации
            // Crosshair is drawn last so it stays above fill, grid and axes
            drawCrosshair();
            updateCursorTooltip();
            updateTooltip();
            renderModelTree();
        }
		
		// ====================================================================
		
		// --- Вспомогательные функции для рисования символов нагрузок ---

		// Функция для рисования стрелки (для сил)
		function drawArrow(fromX, fromY, toX, toY, color, arrowheadLength = 10) {
			ctx.strokeStyle = color;
			ctx.fillStyle = color;
			ctx.lineWidth = 0.7 / scale;

			ctx.beginPath();
			ctx.moveTo(fromX, fromY);
			ctx.lineTo(toX, toY);
			ctx.stroke();

			const angle = Math.atan2(toY - fromY, toX - fromX);
			const headLen = arrowheadLength / scale;
			const headAngle = Math.PI / 10;

			ctx.beginPath();
			ctx.moveTo(toX, toY);
			ctx.lineTo(toX - headLen * Math.cos(angle - headAngle), toY - headLen * Math.sin(angle - headAngle));
			ctx.lineTo(toX - headLen * Math.cos(angle + headAngle), toY - headLen * Math.sin(angle + headAngle));
			ctx.closePath();
			ctx.fill();
		}

		// Функция для рисования дуговой стрелки (для моментов)
		function drawArcArrow(centerX, centerY, radius, startAngle, endAngle, counterClockwise, color, arrowheadLength = 10) {
			ctx.strokeStyle = color;
			ctx.fillStyle = color;
			ctx.lineWidth = 1 / scale;

			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, startAngle, endAngle, counterClockwise);
			ctx.stroke();

			const arrowAngle = endAngle;
			const headLen = arrowheadLength / scale;
			const headAngle = Math.PI / 10;

			let headTangentAngle = arrowAngle;
			if (counterClockwise) {
				headTangentAngle -= Math.PI / 2;
			} else {
				headTangentAngle += Math.PI / 2;
			}

			const arrowPointX = centerX + radius * Math.cos(arrowAngle);
			const arrowPointY = centerY + radius * Math.sin(arrowAngle);

			ctx.beginPath();
			ctx.moveTo(arrowPointX, arrowPointY);
			ctx.lineTo(arrowPointX - headLen * Math.cos(headTangentAngle - headAngle), arrowPointY - headLen * Math.sin(headTangentAngle - headAngle));
			ctx.lineTo(arrowPointX - headLen * Math.cos(headTangentAngle + headAngle), arrowPointY - headLen * Math.sin(headTangentAngle + headAngle));
			ctx.closePath();
			ctx.fill();
		}

		function drawGrid() {
            let gridBaseUnit = 'm';
            if (currentUnit === 'ft' || currentUnit === 'in') {
                gridBaseUnit = 'ft';
            }

            const baseGridStep = 1; 
            const gridStep_currentUnit = convertUnits(baseGridStep, gridBaseUnit, currentUnit);
            const subGridStep_currentUnit = gridStep_currentUnit / divisionsPerUnit;

            const worldView = {
                minX: screenToWorld(0, 0).x,
                maxX: screenToWorld(canvas.width, 0).x,
                minY: screenToWorld(0, canvas.height).y, 
                maxY: screenToWorld(0, 0).y             
            };
            
            ctx.strokeStyle = '#D0D0D0';
            ctx.lineWidth = 0.5 / scale; // 0.5px толщиной независимо от масштаба
            const startX_currentUnit = Math.floor(worldView.minX / subGridStep_currentUnit) * subGridStep_currentUnit;
            const endX_currentUnit = Math.ceil(worldView.maxX / subGridStep_currentUnit) * subGridStep_currentUnit;
            const startY_currentUnit = Math.floor(Math.min(worldView.minY, worldView.maxY) / subGridStep_currentUnit) * subGridStep_currentUnit;
            const endY_currentUnit = Math.ceil(Math.max(worldView.minY, worldView.maxY) / subGridStep_currentUnit) * subGridStep_currentUnit;

            ctx.beginPath();
            for (let x = startX_currentUnit; x <= endX_currentUnit; x += subGridStep_currentUnit) {
                ctx.moveTo(x, startY_currentUnit);
                ctx.lineTo(x, endY_currentUnit);
            }

            for (let y = startY_currentUnit; y <= endY_currentUnit; y += subGridStep_currentUnit) {
                ctx.moveTo(startX_currentUnit, y);
                ctx.lineTo(endX_currentUnit, y);
            }
            ctx.stroke();
        }

		function drawAxes() {
            ctx.strokeStyle = '#B0B0B0';
            ctx.lineWidth = 1 / scale;
            ctx.fillStyle = '#B0B0B0';
            const fontSizeWorld = 12 / scale; 
            ctx.font = `${fontSizeWorld}px Arial`;

            const visMinX = screenToWorld(0,0).x; 
            const visMaxX = screenToWorld(canvas.width,0).x; 
            const visMinY_world = screenToWorld(0,canvas.height).y; 
            const visMaxY_world = screenToWorld(0,0).y;         

            ctx.beginPath(); 
            ctx.moveTo(visMinX, 0); 
            ctx.lineTo(visMaxX, 0);
            ctx.stroke();

            ctx.beginPath(); 
            ctx.moveTo(0, visMinY_world); 
            ctx.lineTo(0, visMaxY_world);
            ctx.stroke();

            let axisLabelBaseUnit = 'm';
            if (currentUnit === 'ft' || currentUnit === 'in') {
                axisLabelBaseUnit = 'ft';
            }
            const minLabelSpacingPx = 50;
            const stepSequence = [1, 2, 5];
            let stepIndex = 0;
            let magnitude = 1;
            let unitLabelIncrement = stepSequence[stepIndex];
            while (convertUnits(unitLabelIncrement, axisLabelBaseUnit, currentUnit) * scale < minLabelSpacingPx) {
                stepIndex++;
                if (stepIndex >= stepSequence.length) {
                    stepIndex = 0;
                    magnitude *= 10;
                }
                unitLabelIncrement = stepSequence[stepIndex] * magnitude;
            }

            const xLabelYOffsetWorld = fontSizeWorld * 0.5;

            // X-axis labels
            const xLabelMinVal = Math.floor(convertUnits(visMinX, currentUnit, axisLabelBaseUnit) / unitLabelIncrement) * unitLabelIncrement;
            const xLabelMaxVal = Math.ceil(convertUnits(visMaxX, currentUnit, axisLabelBaseUnit) / unitLabelIncrement) * unitLabelIncrement;
            for (let val = xLabelMinVal; val <= xLabelMaxVal; val += unitLabelIncrement) {
                const worldX_currentUnit = convertUnits(val, axisLabelBaseUnit, currentUnit);
                const labelText = val.toFixed(0);
                
                ctx.save();
                ctx.translate(worldX_currentUnit, xLabelYOffsetWorld); 
                ctx.scale(1, -1); 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom'; 
                ctx.fillText(labelText, 0, 0);
                ctx.restore();
            }
            
            // Y-axis labels
            const yLabelXOffsetWorld = -fontSizeWorld * 0.5;
            const visMinY_base = convertUnits(Math.min(visMinY_world, visMaxY_world), currentUnit, axisLabelBaseUnit);
            const visMaxY_base = convertUnits(Math.max(visMinY_world, visMaxY_world), currentUnit, axisLabelBaseUnit);
            const yLabelMinVal = Math.floor(visMinY_base / unitLabelIncrement) * unitLabelIncrement;
            const yLabelMaxVal = Math.ceil(visMaxY_base / unitLabelIncrement) * unitLabelIncrement;
            for (let val = yLabelMinVal; val <= yLabelMaxVal; val += unitLabelIncrement) {
                if (val === 0) continue;
                const worldY_currentUnit = convertUnits(val, axisLabelBaseUnit, currentUnit);
                const labelText = val.toFixed(0);
                
                ctx.save();
                ctx.translate(yLabelXOffsetWorld, worldY_currentUnit);
                ctx.scale(1, -1);
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, 0, 0);
                ctx.restore();
            }
        }

		function drawNodes() {
			const nodeRadiusWorld = 2 / scale;
			const nodeIdFontSizeWorld = 12 / scale;
			
			nodes.forEach(node => {
				ctx.save(); // НОВОЕ: Сохраняем состояние контекста для этого узла
				ctx.beginPath();
				ctx.arc(node.x, node.y, nodeRadiusWorld, 0, 2 * Math.PI);
				
				const isSelected = selectedElements.some(el => el.type === 'node' && el.element.node_id === node.node_id);

				if (isSelected) {
					ctx.fillStyle = '#FF6D2D'; // Оранжево-красный для выделенного
				} else if (hoveredElement && hoveredElement.type === 'node' && hoveredElement.element.node_id === node.node_id) {
					ctx.fillStyle = '#dc3545'; // Красный для наведения
				} else {
					ctx.fillStyle = '#007bff'; // Синий по умолчанию
				}

				ctx.fill();
				// ctx.strokeStyle = '#343a40'; // Оставляем закомментированным, как вы просили убрать обводку
				// ctx.lineWidth = 1.5 / scale;
				// ctx.stroke();

				if (showNodeIds) {
					ctx.save(); // Сохраняем состояние для преобразований текста
					ctx.translate(node.x + 7/scale, node.y - 5/scale);
					ctx.scale(1, -1);
					
                                        ctx.fillStyle = '#6279B8';
                                        ctx.font = `${nodeIdFontSizeWorld}px Roboto`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(node.node_id, 0, -(nodeRadiusWorld + (nodeIdFontSizeWorld / 2) + 2/scale));
					ctx.restore(); // Восстанавливаем состояние после преобразований текста
				}
				ctx.restore(); // НОВОЕ: Восстанавливаем состояние контекста после отрисовки этого узла
			});
		}

        // ===============================================
        // Функция для рисования ВСЕХ иконок закреплений на Canvas
        // ===============================================
        function drawRestrictions() {
            restrictions.forEach(restriction => {
                const node = nodes.find(n => n.node_id === restriction.node_id);
                if (node) {
                    let iconToDraw = null;
                    for (const typeKey in restrictionTypes) {
                        const type = restrictionTypes[typeKey];
                        if (type.icon && type.dx === restriction.dx && type.dy === restriction.dy && type.dr === restriction.dr) {
                            iconToDraw = typeKey;
                            break;
                        }
                    }

                    if (iconToDraw) {
                        drawRestrictionIcon(ctx, node.x, node.y, scale, iconToDraw);
                    }
                }
            });
        }
		
		// --- Обновленная функция для отрисовки узловых нагрузок ---
                function drawNodeLoads() {
                        const LOAD_COLOR = 'black';

			const FIXED_ARROW_LENGTH_PX = 70; 
			const FIXED_MOMENT_RADIUS_PX = 35; 
			const FIXED_TEXT_OFFSET_PX = 10; 

			nodeLoads.forEach(load => {
				const node = nodes.find(n => n.node_id === load.target_id);
				if (!node) return;

                const currentForceDisplayUnit = forceUnitsSelect.value;
                const currentLengthDisplayUnit = unitsSelect.value;

                let displayedValue;
                let displayedUnitString;

                if (load.type === 'point_force') {
                    displayedValue = convertForce(load.value, load.unit, currentForceDisplayUnit).toFixed(2);
                    displayedUnitString = currentForceDisplayUnit;
                } else if (load.type === 'moment') {
                    displayedValue = convertMoment(load.value, load.unit, load.lengthUnit, currentForceDisplayUnit, currentLengthDisplayUnit).toFixed(2);
                    displayedUnitString = `${currentForceDisplayUnit}*${currentLengthDisplayUnit}`;
                }

				const drawX = node.x;
				const drawY = node.y;

				const currentArrowLength = FIXED_ARROW_LENGTH_PX / scale;
				const currentMomentRadius = FIXED_MOMENT_RADIUS_PX / scale;
				const currentTextOffset = FIXED_TEXT_OFFSET_PX / scale;

                                ctx.font = `${12 / scale}px Roboto`;
				ctx.fillStyle = LOAD_COLOR;
				ctx.textBaseline = 'middle'; 

				if (load.type === 'point_force') {
					let fromX, fromY, toX, toY;
					let textX, textY;

					toX = drawX;
					toY = drawY;

					if (load.component === 'x') {
						fromX = drawX - (load.value > 0 ? currentArrowLength : -currentArrowLength);
						fromY = drawY;
						
						textX = fromX + (load.value > 0 ? -currentTextOffset : currentTextOffset) * 0;
						textY = fromY + currentTextOffset * 0.5; 
						ctx.textAlign = load.value > 0 ? 'left': 'right';
						ctx.textBaseline = 'bottom';
					} else if (load.component === 'y') {
						fromX = drawX;
						fromY = drawY - (load.value > 0 ? currentArrowLength : -currentArrowLength);
						
						textX = fromX + currentTextOffset;
						textY = fromY + (load.value > 0 ? -currentTextOffset : currentTextOffset) * 0; 
						ctx.textBaseline = load.value > 0 ? 'bottom' : 'top';
						ctx.textAlign = 'left';
					}

					drawArrow(fromX, fromY, toX, toY, LOAD_COLOR);
					
					ctx.save();
					ctx.scale(1, -1);
					ctx.fillText(`${displayedValue} ${displayedUnitString}`, textX, -textY); 
					ctx.restore();

				} else if (load.type === 'moment') {
					let startAngle, endAngle, counterClockwise;
					const arcLength = Math.PI * (90 / 180);

					if (load.value > 0) {
						startAngle = Math.PI / 4;
						endAngle = startAngle - arcLength;
						counterClockwise = false;
					} else {
						startAngle = Math.PI / 1.33333;
						endAngle = startAngle + arcLength;
						counterClockwise = true;
					}

					drawArcArrow(drawX, drawY, currentMomentRadius, startAngle, endAngle, counterClockwise, LOAD_COLOR); 

					const textArcAngle = endAngle; 
					const textPosX = drawX + (currentMomentRadius + currentTextOffset) * Math.cos(textArcAngle);
					const textPosY = drawY + (currentMomentRadius + currentTextOffset) * Math.sin(textArcAngle);
					
					ctx.save();
					ctx.scale(1, -1);
					ctx.textAlign = load.value > 0 ? 'left' : 'right';
					ctx.fillText(`${displayedValue} ${displayedUnitString}`, textPosX, -textPosY); 
					ctx.restore();
                                }
                        });
                }

                function drawReactions() {
                        if (!showReactions || reactionsData.length === 0 || !resultsData) return;

                        const LOAD_COLOR = 'black';
                        const FIXED_ARROW_LENGTH_PX = 70;
                        const FIXED_MOMENT_RADIUS_PX = 35;
                        const FIXED_TEXT_OFFSET_PX = 10;

                        const resultsForceUnit = resultsData.units?.force || 'kN';
                        const resultsLengthUnit = resultsData.units?.length || 'm';
                        const currentForceDisplayUnit = forceUnitsSelect.value;
                        const currentLengthDisplayUnit = unitsSelect.value;

                        reactionsData.forEach(reaction => {
                                const nodeId = reaction.nodeId || reaction.node_id;
                                const node = nodes.find(n => n.node_id === nodeId || `node${n.node_id}` === nodeId || n.node_id === parseInt(nodeId));
                                if (!node) return;

                                const drawX = node.x;
                                const drawY = node.y;

                                const arrowLength = FIXED_ARROW_LENGTH_PX / scale;
                                const momentRadius = FIXED_MOMENT_RADIUS_PX / scale;
                                const textOffset = FIXED_TEXT_OFFSET_PX / scale;

                                ctx.font = `${12 / scale}px Roboto`;
                                ctx.fillStyle = LOAD_COLOR;
                                ctx.textBaseline = 'middle';

                                const fx = reaction.FX || reaction.Fx || reaction.fx || 0;
                                if (Math.abs(fx) > 1e-8) {
                                        const fromX = drawX - (fx > 0 ? arrowLength : -arrowLength);
                                        const fromY = drawY;
                                        drawArrow(fromX, fromY, drawX, drawY, LOAD_COLOR);

                                        const displayedValue = convertForce(fx, resultsForceUnit, currentForceDisplayUnit).toFixed(2);
                                        const textX = fromX;
                                        const textY = fromY + textOffset * 0.5;
                                        ctx.save();
                                        ctx.scale(1, -1);
                                        ctx.textAlign = fx > 0 ? 'left' : 'right';
                                        ctx.textBaseline = 'bottom';
                                        ctx.fillText(`${displayedValue} ${currentForceDisplayUnit}`, textX, -textY);
                                        ctx.restore();
                                }

                                const fy = reaction.FY || reaction.Fy || reaction.fy || 0;
                                if (Math.abs(fy) > 1e-8) {
                                        const fromX = drawX;
                                        const fromY = drawY - (fy > 0 ? arrowLength : -arrowLength);
                                        drawArrow(fromX, fromY, drawX, drawY, LOAD_COLOR);

                                        const displayedValue = convertForce(fy, resultsForceUnit, currentForceDisplayUnit).toFixed(2);
                                        const textX = fromX + textOffset;
                                        const textY = fromY;
                                        ctx.save();
                                        ctx.scale(1, -1);
                                        ctx.textAlign = 'left';
                                        ctx.textBaseline = fy > 0 ? 'bottom' : 'top';
                                        ctx.fillText(`${displayedValue} ${currentForceDisplayUnit}`, textX, -textY);
                                        ctx.restore();
                                }

                                const mz = reaction.MZ || reaction.M || reaction.m || 0;
                                if (Math.abs(mz) > 1e-8) {
                                        const arcLength = Math.PI * (90 / 180);
                                        let startAngle, endAngle, counterClockwise;
                                        if (mz > 0) {
                                                startAngle = Math.PI / 1.33333;
                                                endAngle = startAngle + arcLength;
                                                counterClockwise = true;
                                        } else {
                                                startAngle = Math.PI / 4;
                                                endAngle = startAngle - arcLength;
                                                counterClockwise = false;
                                        }

                                        drawArcArrow(drawX, drawY, momentRadius, startAngle, endAngle, counterClockwise, LOAD_COLOR);

                                        const displayedValue = convertMoment(mz, resultsForceUnit, resultsLengthUnit, currentForceDisplayUnit, currentLengthDisplayUnit).toFixed(2);
                                        const textArcAngle = endAngle;
                                        const textPosX = drawX + (momentRadius + textOffset) * Math.cos(textArcAngle);
                                        const textPosY = drawY + (momentRadius + textOffset) * Math.sin(textArcAngle);
                                        ctx.save();
                                        ctx.scale(1, -1);
                                        ctx.textAlign = mz > 0 ? 'right' : 'left';
                                        ctx.fillText(`${displayedValue} ${currentForceDisplayUnit}*${currentLengthDisplayUnit}`, textPosX, -textPosY);
                                        ctx.restore();
                                }
                        });
                }
		
		// НОВАЯ ФУНКЦИЯ: Отрисовка распределенных нагрузок
        function drawDistributedLoads() {
            const LOAD_COLOR = 'green';
            const DIST_LOAD_ARROW_LENGTH_PX = 15;
            const DIST_LOAD_OFFSET_PX = 0;
            const DIST_LOAD_RECT_WIDTH_PX = 15;
            const DIST_LOAD_TEXT_OFFSET_PX = 15;
            const ARROW_HEAD_LENGTH_PX = 8;

            const currentForceDisplayUnit = forceUnitsSelect.value;
            const currentLengthDisplayUnit = unitsSelect.value;

            // --- Determine scaling for arrow lengths and rectangle heights ---
            const loadMagnitudes = elementLoads.map(ld => {
                const sf = ld.unit.split('/')[0];
                const sl = ld.unit.split('/')[1];
                return Math.abs(convertDistributedForce(ld.startValue, sf, sl, currentForceDisplayUnit, currentLengthDisplayUnit));
            });

            const maxMagnitude = loadMagnitudes.length > 0 ? Math.max(...loadMagnitudes) : 0;
            const minMagnitude = loadMagnitudes.length > 0 ? Math.min(...loadMagnitudes) : 0;
            const useScaling = elementLoads.length > 1 && Math.abs(maxMagnitude - minMagnitude) > 1e-8;

            const canvasHeightWorld = canvas.height / scale;
            const maxArrowLengthWorldLimit = canvasHeightWorld / 8;
            const minArrowLengthWorldLimit = canvasHeightWorld / 25;
            const defaultArrowLengthWorld = DIST_LOAD_ARROW_LENGTH_PX / scale;

            const uniqueLoadElements = new Set(elementLoads.map(ld => ld.target_elem_id));
            const useRelativeMaxScaling = uniqueLoadElements.size > 2 && maxMagnitude > 0;
            const maxRelativeArrowWorld = canvasHeightWorld / 16;

            elementLoads.forEach((load, idx) => {
                const line = lines.find(l => l.elem_id === load.target_elem_id);
                if (!line) return;

                const node1 = nodes.find(n => n.node_id === line.nodeId1);
                const node2 = nodes.find(n => n.node_id === line.nodeId2);
                if (!node1 || !node2) return;

                const currentDistributedForceUnit = `${currentForceDisplayUnit}/${currentLengthDisplayUnit}`;

                const storedForceUnit = load.unit.split('/')[0];
                const storedLengthUnit = load.unit.split('/')[1];

                const displayedValue = parseFloat(convertDistributedForce(load.startValue, storedForceUnit, storedLengthUnit, currentForceDisplayUnit, currentLengthDisplayUnit).toFixed(2));
                const displayedUnitString = currentDistributedForceUnit;
                const magnitude = loadMagnitudes[idx];

                const dx_line = node2.x - node1.x;
                const dy_line = node2.y - node1.y;
                const lineLength = Math.sqrt(dx_line * dx_line + dy_line * dy_line);

                if (lineLength === 0) return;

                const lineAngle = Math.atan2(dy_line, dx_line);

                const singleLoadOrUniform = elementLoads.length === 1 || Math.abs(maxMagnitude - minMagnitude) < 1e-8; // uniform loads

                let arrowLengthWorld = defaultArrowLengthWorld;

                if (singleLoadOrUniform) {
                    // constant arrow height when only one or identical loads
                    arrowLengthWorld = canvasHeightWorld / 25;
                } else if (useRelativeMaxScaling) {
                    arrowLengthWorld = (magnitude / maxMagnitude) * maxRelativeArrowWorld;
                } else if (useScaling) {
                    const norm = (magnitude - minMagnitude) / (maxMagnitude - minMagnitude);
                    arrowLengthWorld = minArrowLengthWorldLimit + norm * (maxArrowLengthWorldLimit - minArrowLengthWorldLimit);
                    arrowLengthWorld = Math.max(minArrowLengthWorldLimit, Math.min(maxArrowLengthWorldLimit, arrowLengthWorld));
                }

                const offsetWorld = DIST_LOAD_OFFSET_PX / scale;
                const rectWidthWorld = DIST_LOAD_RECT_WIDTH_PX / scale;
                const textOffsetWorld = DIST_LOAD_TEXT_OFFSET_PX / scale;
                const arrowHeadLengthWorld = ARROW_HEAD_LENGTH_PX / scale;

                ctx.save();
                ctx.strokeStyle = LOAD_COLOR;
                ctx.fillStyle = LOAD_COLOR;
                ctx.lineWidth = 0.7 / scale;
                ctx.font = `${12 / scale}px Roboto`;
                ctx.textBaseline = 'middle';

                let perpDx, perpDy;
                if (load.component === 'x') {
                    perpDx = 0;
                    perpDy = (load.startValue > 0) ? 1 : -1; 
                } else {
                    perpDx = (load.startValue > 0) ? -1 : 1; 
                    perpDy = 0;
                }

                const perpVectorLength = Math.sqrt(perpDx * perpDx + perpDy * perpDy);
                if (perpVectorLength > 0) {
                    perpDx = (perpDx / perpVectorLength) * offsetWorld;
                    perpDy = (perpDy / perpVectorLength) * offsetWorld;
                }

				// --- Определение координат четырех вершин четырехугольника ---
				let p1_world = { x: node1.x, y: node1.y };
				let p2_world = { x: node2.x, y: node2.y };

				let p3_world = {};
				let p4_world = {};

				if (load.component === 'y') {
					p3_world.x = node2.x;
					p4_world.x = node1.x;

					if (load.startValue > 0) {
						p3_world.y = node2.y - arrowLengthWorld;
						p4_world.y = node1.y - arrowLengthWorld;
					} else {
						p3_world.y = node2.y + arrowLengthWorld;
						p4_world.y = node1.y + arrowLengthWorld;
					}
				} else if (load.component === 'x') {
					p3_world.y = node2.y;
					p4_world.y = node1.y;

					if (load.startValue > 0) {
						p3_world.x = node2.x - arrowLengthWorld;
						p4_world.x = node1.x - arrowLengthWorld;
					} else {
						p3_world.x = node2.x + arrowLengthWorld;
						p4_world.x = node1.x + arrowLengthWorld;
					}
				}

				// --- Построение четырехугольника ---
				ctx.beginPath();
				ctx.moveTo(p1_world.x, p1_world.y);
				ctx.lineTo(p2_world.x, p2_world.y);
				ctx.lineTo(p3_world.x, p3_world.y);
				ctx.lineTo(p4_world.x, p4_world.y);
				ctx.closePath();

				ctx.fillStyle = 'green';
				ctx.globalAlpha = 0.2;
				ctx.fill();

				ctx.globalAlpha = 0.7;
				ctx.strokeStyle = 'green';
				ctx.lineWidth = 0.5 / scale;
				ctx.stroke();

                const numArrows = Math.max(2, Math.floor(lineLength / (arrowLengthWorld * 2))); 
                for (let i = 0; i <= numArrows; i++) {
                    const t = i / numArrows;
                    const currentPointX = node1.x + dx_line * t;
                    const currentPointY = node1.y + dy_line * t;

                    let arrowFromX, arrowFromY, arrowToX, arrowToY;

                    if (load.component === 'x') {
                        arrowToX = currentPointX + perpDx;
                        arrowToY = currentPointY + perpDy;
                        arrowFromX = arrowToX - (load.startValue > 0 ? arrowLengthWorld : -arrowLengthWorld);
                        arrowFromY = arrowToY;						
                    } else {
						arrowToX = currentPointX + perpDx;
                        arrowToY = currentPointY + perpDy;
                        arrowFromX = arrowToX;
                        arrowFromY = arrowToY - (load.startValue > 0 ? arrowLengthWorld : -arrowLengthWorld);
                    }
                    
                    drawArrow(arrowFromX, arrowFromY, arrowToX, arrowToY, LOAD_COLOR, arrowHeadLengthWorld * scale); 
                }

                const midPointX = node1.x + dx_line / 2;
                const midPointY = node1.y + dy_line / 2;

                let textX, textY;
                if (load.component === 'x') {
                    textX = midPointX - perpDx - (load.startValue > 0 ? arrowLengthWorld + textOffsetWorld : -(arrowLengthWorld + textOffsetWorld));
                    textY = midPointY + perpDy;
                    ctx.textAlign = load.startValue > 0 ? 'right' : 'left';
                    ctx.textBaseline = 'middle';
                } else {
                    textX = midPointX + perpDx;
                    textY = midPointY - perpDy - (load.startValue > 0 ? arrowLengthWorld + textOffsetWorld : -(arrowLengthWorld + textOffsetWorld));
                    ctx.textAlign = 'center';
                    ctx.textBaseline = load.startValue > 0 ? 'bottom' : 'top';
                }
                
                ctx.save();
                ctx.scale(1, -1);
				ctx.globalAlpha = 1;
                ctx.fillText(`${displayedValue} ${displayedUnitString}`, textX, -textY);
                ctx.restore();

                ctx.restore();
            });
        }

        // ===============================================
        // Функции для рисования КОНКРЕТНОЙ иконки закрепления на Canvas
        // ===============================================
        const restrictionIconSizeWorld = 15;
        const restrictionIconOffsetWorld = 2;

        function drawRestrictionIcon(ctx, nodeX, nodeY, currentScale, iconType) {
            ctx.save();
            ctx.translate(nodeX, nodeY);
            ctx.scale(1, 1);

            const iconRenderSize = restrictionIconSizeWorld / currentScale;
            const iconRenderOffset = restrictionIconOffsetWorld / currentScale;

            ctx.strokeStyle = '#343a40';
            ctx.lineWidth = 1.1 / currentScale;
            ctx.fillStyle = '#6c757d';

            switch (iconType) {
                case "pinned":
                    ctx.beginPath();
                    ctx.moveTo(0, -iconRenderOffset);
                    ctx.lineTo(-iconRenderSize / 1.5, -(iconRenderOffset + iconRenderSize));
                    ctx.lineTo(iconRenderSize / 1.5, -(iconRenderOffset + iconRenderSize));
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(-iconRenderSize * 0.8, -(iconRenderOffset + iconRenderSize + 0 / currentScale));
                    ctx.lineTo(iconRenderSize * 0.8, -(iconRenderOffset + iconRenderSize + 0 / currentScale));
					ctx.lineWidth = 1.5 / currentScale;
                    ctx.stroke();
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(iconRenderSize * (0.2 - i * 0.5), (iconRenderOffset - iconRenderSize - 12/ currentScale));
                        ctx.lineTo(iconRenderSize * (0.6 - i * 0.5), (iconRenderOffset - iconRenderSize - 5/ currentScale));
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
                    break;
                case "rolled-x":
                    ctx.beginPath();
                    ctx.moveTo(0, -iconRenderOffset*0.5);
                    ctx.lineTo(-iconRenderSize / 1.8, -(iconRenderOffset + iconRenderSize-4/ currentScale));
                    ctx.lineTo(iconRenderSize / 1.8, -(iconRenderOffset + iconRenderSize-4/ currentScale));
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(-iconRenderSize * 0.8, -(iconRenderOffset + iconRenderSize + 0 / currentScale));
                    ctx.lineTo(iconRenderSize * 0.8, -(iconRenderOffset + iconRenderSize + 0 / currentScale));
					ctx.lineWidth = 1.5 / currentScale;
                    ctx.stroke();
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(iconRenderSize * (0.2 - i * 0.5), (iconRenderOffset - iconRenderSize - 12/ currentScale));
                        ctx.lineTo(iconRenderSize * (0.6 - i * 0.5), (iconRenderOffset - iconRenderSize - 5/ currentScale));
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
                    break;
                case "rolled-y":
                    ctx.rotate(Math.PI / 1);
                    ctx.translate(iconRenderOffset, -iconRenderSize * 0); 

                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-(iconRenderSize)*0.9, -iconRenderSize / 1.6);
                    ctx.lineTo(-(iconRenderSize)*0.9, iconRenderSize / 1.6);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
/*-----*/
		    const rollerRadius_y = iconRenderSize * 0.15;
                    const rollerOffsetX_y = iconRenderSize + rollerRadius_y + 1 / currentScale;
/*-----*/
                    ctx.beginPath();
                    ctx.moveTo(-(rollerOffsetX_y + rollerRadius_y - 2 / currentScale), -iconRenderSize * 0.8);
                    ctx.lineTo(-(rollerOffsetX_y + rollerRadius_y - 2 / currentScale), iconRenderSize * 0.8);			
                    ctx.stroke();
                     for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo((iconRenderOffset - iconRenderSize - 12/ currentScale), iconRenderSize * (0.6 - i * 0.5));
                        ctx.lineTo((iconRenderOffset - iconRenderSize - 5/ currentScale), iconRenderSize * (0.2 - i * 0.5));						
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
                    break;
                case "fixed":
                    const fixedHeight = iconRenderSize * 1.5;

                    ctx.beginPath();
                    ctx.moveTo(-iconRenderSize * 0.8, 0);
                    ctx.lineTo(iconRenderSize * 0.8, 0);
					ctx.lineWidth = 1.5 / currentScale;
                    ctx.stroke();
					
                    ctx.moveTo(0, -20/ currentScale);
                    ctx.lineTo(0, 0/ currentScale);
					ctx.stroke();
					
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(iconRenderSize * (0.2 - i * 0.5), -8/ currentScale);
                        ctx.lineTo(iconRenderSize * (0.6 - i * 0.5), 0/ currentScale);
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
                    break;
                case "sleeve-x":

                    const sleeveWidth = iconRenderSize * 0.8;
                    const sleeveHeight = iconRenderSize * 1.2;
					// Горизонт нижняя
                    ctx.beginPath();
                    ctx.moveTo(-iconRenderSize * 0.8, (iconRenderOffset - iconRenderSize + 5 / currentScale));
                    ctx.lineTo(iconRenderSize * 0.8, (iconRenderOffset - iconRenderSize + 5 / currentScale));
					ctx.lineWidth = 1.5 / currentScale;
                    ctx.stroke();
					// Горизонт верхняя
                    ctx.beginPath();
                    ctx.moveTo(-iconRenderSize * 0.8, -(iconRenderOffset - iconRenderSize + 5 / currentScale));
                    ctx.lineTo(iconRenderSize * 0.8, -(iconRenderOffset - iconRenderSize + 5 / currentScale));
					ctx.lineWidth = 1.5 / currentScale;
                    ctx.stroke();
					// Штриховка нижняя
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(iconRenderSize * (0.2 - i * 0.5), (iconRenderOffset - iconRenderSize - 2/ currentScale));
                        ctx.lineTo(iconRenderSize * (0.6 - i * 0.5), (iconRenderOffset - iconRenderSize + 5/ currentScale));
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
					// Штриховка верхняя
					for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(iconRenderSize * (0.6 - i * 0.5), -(iconRenderOffset - iconRenderSize - 2/ currentScale));
                        ctx.lineTo(iconRenderSize * (0.2 - i * 0.5), -(iconRenderOffset - iconRenderSize + 5/ currentScale));
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
                    break;
                case "sleeve-y":
                    ctx.rotate(Math.PI / 2);

                    const sleeveWidth_y = iconRenderSize * 0.8;
                    const sleeveHeight_y = iconRenderSize * 1.2;
					// Горизонт нижняя
                    ctx.beginPath();
                    ctx.moveTo(-iconRenderSize * 0.8, (iconRenderOffset - iconRenderSize + 5 / currentScale));
                    ctx.lineTo(iconRenderSize * 0.8, (iconRenderOffset - iconRenderSize + 5 / currentScale));
					ctx.lineWidth = 1.5 / currentScale;
                    ctx.stroke();
					// Горизонт верхняя
                    ctx.beginPath();
                    ctx.moveTo(-iconRenderSize * 0.8, -(iconRenderOffset - iconRenderSize + 5 / currentScale));
                    ctx.lineTo(iconRenderSize * 0.8, -(iconRenderOffset - iconRenderSize + 5 / currentScale));
					ctx.lineWidth = 1.5 / currentScale;
                    ctx.stroke();
					
					// Штриховка нижняя
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(iconRenderSize * (0.2 - i * 0.5), (iconRenderOffset - iconRenderSize - 2/ currentScale));
                        ctx.lineTo(iconRenderSize * (0.6 - i * 0.5), (iconRenderOffset - iconRenderSize + 5/ currentScale));
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
					
					// Штриховка верхняя
					for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(iconRenderSize * (0.6 - i * 0.5), -(iconRenderOffset - iconRenderSize - 2/ currentScale));
                        ctx.lineTo(iconRenderSize * (0.2 - i * 0.5), -(iconRenderOffset - iconRenderSize + 5/ currentScale));
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1 / currentScale;
                        ctx.stroke();
                    }
                    break;
            }

            ctx.restore();
        }

                function drawLines() {
			const lineIdFontSizeWorld = 12 / scale;
			const lineIdOffsetWorld = 7 / scale;
			const normalLineWidth = 1.25;
			const selectedLineWidth = 3;  // УВЕЛИЧЕННАЯ ТОЛЩИНА ДЛЯ ВЫДЕЛЕННОГО ЭЛЕМЕНТА

			lines.forEach(line => {
				const node1 = nodes.find(n => n.node_id === line.nodeId1);
				const node2 = nodes.find(n => n.node_id === line.nodeId2);
				if (node1 && node2) {
					ctx.save(); // НОВОЕ: Сохраняем состояние контекста для этой линии
					ctx.beginPath();
					ctx.moveTo(node1.x, node1.y);
					ctx.lineTo(node2.x, node2.y);

					const isSelected = selectedElements.some(el => el.type === 'line' && el.element.elem_id === line.elem_id);

					if (isSelected) {
						ctx.strokeStyle = '#FF6D2D'; // Оранжево-красный для выделенного
						ctx.lineWidth = selectedLineWidth / scale;
					} else if (hoveredElement && hoveredElement.type === 'line' && hoveredElement.element.elem_id === line.elem_id) {
						ctx.strokeStyle = '#dc3545'; // Красный для наведения
						ctx.lineWidth = normalLineWidth / scale;
					} else {
						ctx.strokeStyle = '#343a40'; // Темно-серый по умолчанию
						ctx.lineWidth = normalLineWidth / scale;
					}
					ctx.stroke();

					if (showElementIds) {
						ctx.save(); // Сохраняем состояние для преобразований текста
						const midX = (node1.x + node2.x) / 2;
						const midY = (node1.y + node2.y) / 2;

						ctx.translate(midX, midY);
						ctx.scale(1, -1);

						const angle = -Math.atan2(node2.y - node1.y, node2.x - node1.x); 
						
						if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
							ctx.rotate(angle + Math.PI);
						} else {
							ctx.rotate(angle);
						}

						ctx.fillStyle = ctx.strokeStyle; // Берем цвет, который был установлен для обводки линии
                                                ctx.font = `${lineIdFontSizeWorld}px Roboto`;
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';

                                               ctx.fillText(line.elem_id, 0, -lineIdOffsetWorld);

                                               ctx.restore(); // Восстанавливаем состояние после преобразований текста
                                       }

                                        if (showBetaAngleIcons) {
                                            const midX_icon = (node1.x + node2.x) / 2;
                                            const midY_icon = (node1.y + node2.y) / 2;
                                            const iconSize = betaAngleIconSizeWorld / scale;
                                            const iconOffset = betaAngleIconOffsetWorld / scale;
                                            const iconOffsetAlong = betaAngleIconOffsetAlongWorld / scale;

                                            let sectionType = null;
                                            if (line.sectionId) {
                                                    const sec = modelSections.find(s => s.id === line.sectionId);
                                                    if (sec && sec.type) sectionType = sec.type;
                                            }
                                            const img = betaAngleIcons[sectionType] || betaAngleIcons['unknown'];
                                            if (img.complete) {
                                                const dx = node2.x - node1.x;
                                                const dy = node2.y - node1.y;
                                                const theta = Math.atan2(dy, dx);
                                                const offsetX = -Math.sin(theta) * iconOffset + Math.cos(theta) * iconOffsetAlong;
                                                const offsetY = -Math.cos(theta) * iconOffset + Math.sin(theta) * iconOffsetAlong;
                                                const centerX = midX_icon + offsetX;
                                                const centerY = midY_icon + offsetY;

                                                betaIconPositions[line.elem_id] = { x: centerX, y: centerY, size: iconSize };

                                                ctx.save();
                                                ctx.translate(centerX, centerY);
                                                ctx.rotate(theta + (line.betaAngle || 0) * Math.PI / 180);
                                                if (hoveredBetaIconLine && hoveredBetaIconLine.elem_id === line.elem_id) {
                                                    ctx.beginPath();
                                                    ctx.arc(0, 0, iconSize * 0.6, 0, 2 * Math.PI);
                                                    ctx.fillStyle = '#dc3545';
                                                    ctx.globalAlpha = 0.3;
                                                    ctx.fill();
                                                    ctx.globalAlpha = 1.0;
                                                }
                                                ctx.drawImage(img, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
                                                ctx.restore();
                                            }
                                        } else {
                                            delete betaIconPositions[line.elem_id];
                                        }
                                       ctx.restore(); // НОВОЕ: Восстанавливаем состояние контекста после отрисовки этой линии
                               }
                       });
               }

        function drawCrosshair() {
            let drawAtX_screen, drawAtY_screen;
            if (snapToGrid) {
                const screenSnappedPos = worldToScreen(mouse.snappedX, mouse.snappedY);
                drawAtX_screen = screenSnappedPos.x;
                drawAtY_screen = screenSnappedPos.y;
            } else {
                drawAtX_screen = mouse.x;
                drawAtY_screen = mouse.y;
            }

            ctx.save();
            ctx.strokeStyle = '#529774';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);

            ctx.beginPath();
            ctx.moveTo(drawAtX_screen, 0);
            ctx.lineTo(drawAtX_screen, canvas.height);
            ctx.moveTo(0, drawAtY_screen);
            ctx.lineTo(canvas.width, drawAtY_screen);
            ctx.stroke();

            ctx.restore();
        }
        
        // Event Handlers
        function addEventListeners() {
            window.addEventListener('resize', resizeCanvas);
            canvas.addEventListener('mousedown', handleMouseDown);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseleave', handleMouseLeave);
            canvas.addEventListener('mouseup', handleMouseUp);
            canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
            canvas.addEventListener('contextmenu', handleContextMenu);
            document.addEventListener('click', handleClickOutsideContextMenu);

            divisionsInput.addEventListener('change', () => {
                divisionsPerUnit = parseInt(divisionsInput.value) || 1;
                if (divisionsPerUnit < 1) divisionsPerUnit = 1;
                if (divisionsPerUnit > 20) divisionsPerUnit = 20;
                divisionsInput.value = divisionsPerUnit;
                draw();
            });
            snapToGridCheckbox.addEventListener('change', () => {
                snapToGrid = snapToGridCheckbox.checked;
                const worldCoords = screenToWorld(mouse.x, mouse.y); 
                const snapped = getSnappedCoordinates(worldCoords.x, worldCoords.y); 
                mouse.snappedX = snapped.x;
                mouse.snappedY = snapped.y; 
                draw();
            });
            // НОВОЕ: Обработчик для кнопки сохранения модели
            if (saveModelBtn) {
                saveModelBtn.addEventListener('click', saveModel);
            }

            // Обработчик для кнопки "Загрузить"
            if (loadModelBtn && fileInput) {
                loadModelBtn.addEventListener('click', () => {
                    fileInput.click();
                });
            }

            if (importMenuItem && fileInput) {
                importMenuItem.addEventListener('click', () => {
                    fileInput.click();
                });
            }

            if (exportMenuItem) {
                exportMenuItem.addEventListener('click', saveModel);
            }

            if (shareMenu) {
                shareMenu.addEventListener('click', () => {});
            }

            if (analyzeMenu && resultsFileInput) {
                analyzeMenu.addEventListener('click', () => {
                    resultsFileInput.click();
                });
            }

            if (resultsFileInput) {
                resultsFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        await loadResults(ev.target.result);
                        resultsFileInput.value = '';
                    };
                    reader.readAsText(file);
                });
            }

            if (resultsMyMenuItem) {
                resultsMyMenuItem.addEventListener('click', () => {
                    if (activeDiagram === 'My') {
                        activeDiagram = null;
                        resultsMyMenuItem.classList.remove('active');
                    } else {
                        activeDiagram = 'My';
                        resultsMyMenuItem.classList.add('active');
                        if (resultsQzMenuItem) resultsQzMenuItem.classList.remove('active');
                        if (resultsUxyMenuItem) resultsUxyMenuItem.classList.remove('active');
                    }
                    draw();
                });
            }

            if (resultsQzMenuItem) {
                resultsQzMenuItem.addEventListener('click', () => {
                    if (activeDiagram === 'Qz') {
                        activeDiagram = null;
                        resultsQzMenuItem.classList.remove('active');
                    } else {
                        activeDiagram = 'Qz';
                        resultsQzMenuItem.classList.add('active');
                        if (resultsMyMenuItem) resultsMyMenuItem.classList.remove('active');
                        if (resultsUxyMenuItem) resultsUxyMenuItem.classList.remove('active');
                    }
                    draw();
                });
            }

            if (resultsUxyMenuItem) {
                resultsUxyMenuItem.addEventListener('click', () => {
                    if (activeDiagram === 'Uxy') {
                        activeDiagram = null;
                        resultsUxyMenuItem.classList.remove('active');
                    } else {
                        activeDiagram = 'Uxy';
                        resultsUxyMenuItem.classList.add('active');
                        if (resultsMyMenuItem) resultsMyMenuItem.classList.remove('active');
                        if (resultsQzMenuItem) resultsQzMenuItem.classList.remove('active');
                    }
                    draw();
                });
            }

            if (resultsReactionsMenuItem) {
                resultsReactionsMenuItem.addEventListener('click', () => {
                    showReactions = !showReactions;
                    resultsReactionsMenuItem.classList.toggle('active', showReactions);
                    draw();
                });
            }

            // Обработчик для изменения (выбора) файла в поле ввода
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    console.log("Файл не выбран.");
                    return;
                }

                const reader = new FileReader();

                reader.onload = async (event) => {
                    const fileContent = event.target.result;
                    await loadModel(fileContent);
                    fileInput.value = ''; 
                };

                reader.onerror = (error) => {
                    console.error("Ошибка чтения файла:", error);
                    console.error("Не удалось прочитать файл.");
                };

                reader.readAsText(file);
            });
            }
            
            unitsSelect.addEventListener('change', (e) => {
                const oldUnit = currentUnit;
                const newUnit = e.target.value;
                if (oldUnit === newUnit) return;

                nodes.forEach(node => { 
                    node.x = convertUnits(node.x, oldUnit, newUnit);
                    node.y = convertUnits(node.y, oldUnit, newUnit);
                });

				nodeLoads.forEach(load => {
                    if (load.type === 'moment') {
                        load.value = convertMoment(load.value, load.unit, oldUnit, load.unit, newUnit);
                        load.lengthUnit = newUnit; 
                    }
                });
				
                elementLoads.forEach(load => {
                    const storedForceUnit = load.unit.split('/')[0];
                    const storedLengthUnit = load.unit.split('/')[1];

                    load.startValue = convertDistributedForce(load.startValue, storedForceUnit, storedLengthUnit, storedForceUnit, newUnit);
                    load.endValue = convertDistributedForce(load.endValue, storedForceUnit, storedLengthUnit, storedForceUnit, newUnit);
                    
                    load.unit = `${storedForceUnit}/${newUnit}`;
                });

                scale = scale * (lengthUnitConversions[newUnit] / lengthUnitConversions[oldUnit]);
                currentUnit = newUnit;
				
                if (newUnit === 'mm' || newUnit === 'cm' || newUnit === 'in') {
                    snapToGrid = false;
                    snapToGridCheckbox.checked = false;
                } else {
                    snapToGrid = true;
                    snapToGridCheckbox.checked = true;
                }
                
                const worldCoordsNow = screenToWorld(mouse.x, mouse.y); 
                const snappedNow = getSnappedCoordinates(worldCoordsNow.x, worldCoordsNow.y);
                mouse.worldX = worldCoordsNow.x;
                mouse.worldY = worldCoordsNow.y; 
                mouse.snappedX = snappedNow.x;
                mouse.snappedY = snappedNow.y; 

                updatePropertiesPanel();
                draw();
				
				updateForceUnitDisplay();
                updateUnitPairsSelect();
            });

			// НОВОЕ: Слушатель событий для изменения единиц силы
            forceUnitsSelect.addEventListener('change', (e) => {
                const newForceUnit = e.target.value;
                const oldForceUnit = forceUnitsSelect.dataset.previousValue;

                forceUnitsSelect.dataset.previousValue = newForceUnit;

				nodeLoads.forEach(load => {
                    if (load.type === 'point_force') {
                        load.value = convertForce(load.value, load.unit, newForceUnit);
                        load.unit = newForceUnit; 
                    } else if (load.type === 'moment') {
                        load.value = convertMoment(load.value, load.unit, load.lengthUnit, newForceUnit, load.lengthUnit);
                        load.unit = newForceUnit; 
                    }
                });
				
                elementLoads.forEach(load => {
                    const storedForceUnit = load.unit.split('/')[0];
                    const storedLengthUnit = load.unit.split('/')[1];

                    load.startValue = convertDistributedForce(load.startValue, storedForceUnit, storedLengthUnit, newForceUnit, storedLengthUnit);
                    load.endValue = convertDistributedForce(load.endValue, storedForceUnit, storedLengthUnit, newForceUnit, storedLengthUnit);
                    
                    load.unit = `${newForceUnit}/${storedLengthUnit}`;
                });

                updateForceUnitDisplay(); 
				updateUnitPairsSelect();
            });

			// НОВОЕ: Слушатель событий для изменения наборов единиц
            unitPairsSelect.addEventListener('change', (e) => {
                const selectedPairKey = e.target.value;
                currentUnitPair = selectedPairKey;

                if (selectedPairKey !== 'none') {
                    const targetUnits = unitPairConversions[selectedPairKey];
                    
                    unitsSelect.value = targetUnits.length;
                    unitsSelect.dispatchEvent(new Event('change')); 

                    forceUnitsSelect.value = targetUnits.force;
                    forceUnitsSelect.dataset.previousValue = targetUnits.force; 
                    forceUnitsSelect.dispatchEvent(new Event('change')); 
                }
            });

            deleteNodeItem.addEventListener('click', handleDeleteNode);
            deleteLineItem.addEventListener('click', handleDeleteLine);
            copyNodeItem.addEventListener('click', openCopyNodeModal);
            applyCopyNodeBtn.addEventListener('click', applyCopyNode);
            copyNodeModal.addEventListener('click', (e) => {
                if (e.target === copyNodeModal) {
                    closeCopyNodeModal();
                }
            });

        }

		function handleMouseDown(e) {
			e.preventDefault();
			hideContextMenu(); // Убедитесь, что эта функция существует, или закомментируйте её

			const rect = canvas.getBoundingClientRect();
			mouse.x = e.clientX - rect.left;
			mouse.y = e.clientY - rect.top; // Используем rect.top для консистентности, если в вашем коде это так

			// Получаем мировые координаты
			const worldCoords = screenToWorld(mouse.x, mouse.y); 
			mouse.worldX = worldCoords.x;
			mouse.worldY = worldCoords.y; 
			const snapped = getSnappedCoordinates(mouse.worldX, mouse.worldY); 
			mouse.snappedX = snapped.x;
			mouse.snappedY = snapped.y; 

                        const clickedNode = findNodeAt(mouse.worldX, mouse.worldY);
                        const clickedLine = findLineAt(mouse.worldX, mouse.worldY);
                        const clickedBetaIconLine = findBetaIconAt(mouse.worldX, mouse.worldY);

                        if (clickedBetaIconLine && e.button === 0) {
                            clickedBetaIconLine.betaAngle = ((clickedBetaIconLine.betaAngle || 0) + 90) % 360;
                            updatePropertiesPanel();
                            draw();
                            return;
                        }
			
			// --- НОВОЕ: Проверяем нажата ли клавиша Ctrl/Cmd ---
			const isCtrlPressed = e.ctrlKey || e.metaKey; // Для Windows/Linux (Ctrl) и macOS (Cmd)

			if (e.button === 0) { // Левый клик
				// --- СЦЕНАРИЙ 1: Попытка завершить линию (firstNodeForLine активен) ---
				if (firstNodeForLine) {
					if (clickedNode && firstNodeForLine.node_id !== clickedNode.node_id) {
						// Второй клик по другому узлу: пытаемся создать линию
						const exists = lines.some(line =>
							(line.nodeId1 === firstNodeForLine.node_id && line.nodeId2 === clickedNode.node_id) || 
							(line.nodeId1 === clickedNode.node_id && line.nodeId2 === firstNodeForLine.node_id)    
						);
                                                if (!exists) {
                                                        lines.push({ elem_id: nextElemId++, nodeId1: firstNodeForLine.node_id, nodeId2: clickedNode.node_id, structural_type: 'beam', materialId: null, sectionId: null, betaAngle: 0, loads: [] });
                                                        console.log(`Линия ${nextElemId - 1} создана между узлами ${firstNodeForLine.node_id} и ${clickedNode.node_id}.`);
                                                } else {
							console.log(`Линия между узлами ${firstNodeForLine.node_id} и ${clickedNode.node_id} уже существует.`); 
						}
						
						// --- ИЗМЕНЕНИЕ ДЛЯ СКВОЗНОГО ПОСТРОЕНИЯ ЛИНИЙ ---
						// Если линия успешно создана, новый узел становится первым для следующей линии
						firstNodeForLine = clickedNode; // Теперь clickedNode (второй узел) становится новым firstNodeForLine
						selectedNode = clickedNode; // Выделяем новый активный узел
						selectedElement = null; // Сбрасываем выделение линии
						selectedElements = [{ type: 'node', element: clickedNode }]; // Выделяем только этот узел
						// --- КОНЕЦ ИЗМЕНЕНИЯ ---

					} else {
						// Клик по тому же узлу или пустому месту, когда линия ожидала второй узел
						firstNodeForLine = null; // Отменяем построение линии
						selectedNode = null; 
						selectedElement = null;
						selectedElements = []; // Сбрасываем все выделения
					}
				} 
				// --- СЦЕНАРИЙ 2: Клавиша Ctrl/Cmd нажата (множественный выбор) ---
				// Этот блок выполняется, если firstNodeForLine НЕ активен, но Ctrl/Cmd нажат
				else if (isCtrlPressed) { 
					if (clickedNode) {
						// Если клик по узлу с Ctrl: добавить/удалить узел из множественного выделения
						const existingIndex = selectedElements.findIndex(el => el.type === 'node' && el.element.node_id === clickedNode.node_id);
						if (existingIndex > -1) {
							selectedElements.splice(existingIndex, 1); // Удалить, если уже выделен
						} else {
							selectedElements.push({ type: 'node', element: clickedNode }); // Добавить, если не выделен
						}
					} else if (clickedLine) {
						// Если клик по линии с Ctrl: добавить/удалить линию из множественного выделения
						const existingIndex = selectedElements.findIndex(el => el.type === 'line' && el.element.elem_id === clickedLine.elem_id);
						if (existingIndex > -1) {
							selectedElements.splice(existingIndex, 1); // Удалить, если уже выделен
						} else {
							selectedElements.push({ type: 'line', element: clickedLine }); // Добавить, если не выделен
						}
					} else {
						// Клик по пустому месту с Ctrl/Cmd: не меняем текущее множественное выделение
					}
					// В режиме CTRL-выбора, одиночные переменные selectedNode/selectedElement всегда будут null
					selectedNode = null;
					selectedElement = null;
					firstNodeForLine = null; // Всегда очищаем firstNodeForLine в режиме выбора
				}
				// --- СЦЕНАРИЙ 3: Обычный левый клик (одиночный выбор или создание узла) ---
				// Этот блок выполняется, если firstNodeForLine НЕ активен И Ctrl/Cmd НЕ нажат
				else { 
					if (clickedNode) {
						// Обычный клик по узлу: выделяем его И устанавливаем как первый для линии
						// ЭТО ПОВЕДЕНИЕ ВАШЕГО ИСХОДНОГО КОДА, КОТОРОЕ АВТОМАТИЧЕСКИ НАЧИНАЕТ ПОСТРОЕНИЕ ЛИНИИ
						firstNodeForLine = clickedNode; 
						selectedNode = clickedNode; // Одиночное выделение узла
						selectedElement = null;
						selectedElements = [{ type: 'node', element: clickedNode }]; // Обновляем множественное выделение для одиночного выбора
					} else if (clickedLine) {
						// Обычный клик по линии: выделяем только эту линию
						selectedElement = clickedLine; // Одиночное выделение линии
						selectedNode = null;
						firstNodeForLine = null; // Сбрасываем firstNodeForLine
						selectedElements = [{ type: 'line', element: clickedLine }]; // Обновляем множественное выделение для одиночного выбора
					} else { // Клик по пустому месту
						if (selectedNode || selectedElement || firstNodeForLine || selectedElements.length > 0) { 
							// Если что-то было выделено (одиночно или множественно) или линия была наполовину, сбрасываем все
							selectedNode = null;
							selectedElement = null;
							firstNodeForLine = null;
							selectedElements = []; // Очищаем множественное выделение
						} else {
							// Ничего не выделено/не наполовину, клик по пустому месту: создаем новый узел (ВАША ИСХОДНАЯ ЛОГИКА)
							const placeX = snapToGrid ? mouse.snappedX : mouse.worldX; 
							const placeY = snapToGrid ? mouse.snappedY : mouse.worldY;
							const newNode = { node_id: nextNodeId++, x: placeX, y: placeY }; 
							nodes.push(newNode); 
							console.log(`Узел ${newNode.node_id} создан по координатам (${newNode.x.toFixed(3)}, ${newNode.y.toFixed(3)}).`);
							
							// После создания узла, выделения быть не должно
							selectedNode = null; 
							selectedElement = null;
							firstNodeForLine = null; 
							selectedElements = [];
						}
					}
				}
			} else if (e.button === 1) { // Средний клик для панорамирования
				isPanning = true;
				lastPanX = e.clientX;
				lastPanY = e.clientY;
				canvas.style.cursor = 'grabbing';
			}
			updatePropertiesPanel(); // В конце всегда обновляем панель свойств
			draw(); // В конце всегда перерисовываем холст
		}

        function handleMouseMove(e) {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
            
            const worldCoords = screenToWorld(mouse.x, mouse.y); 
            mouse.worldX = worldCoords.x;
            mouse.worldY = worldCoords.y; 
            const snapped = getSnappedCoordinates(worldCoords.x, worldCoords.y);
            mouse.snappedX = snapped.x;
            mouse.snappedY = snapped.y; 

            if (isPanning) {
                const dx = e.clientX - lastPanX;
                const dy = e.clientY - lastPanY;
                panX += dx;
                panY += dy;
                lastPanX = e.clientX;
                lastPanY = e.clientY;
            } else {
                hoveredBetaIconLine = findBetaIconAt(mouse.worldX, mouse.worldY);
                if (hoveredBetaIconLine) {
                    hoveredElement = { type: 'line', element: hoveredBetaIconLine };
                } else {
                    hoveredElement = findElementAt(mouse.worldX, mouse.worldY);
                }
            }
            draw();
        }

        function handleMouseLeave() {
            cursorTooltip.classList.add('hidden');
        }

        function handleMouseUp(e) {
            if (e.button === 1 && isPanning) {
                isPanning = false;
                canvas.style.cursor = 'default';
            }
        }

        function handleWheelZoom(e) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mouseX_screen = e.clientX - rect.left;
            const mouseY_screen = e.clientY - rect.top;

            const worldBeforeZoom = screenToWorld(mouseX_screen, mouseY_screen); 

            const zoomFactor = 1.1;
            let newScale = scale;
            if (e.deltaY < 0) newScale *= zoomFactor; 
            else newScale /= zoomFactor; 
            
            const minScaleFactor = 0.001; 
            const maxScaleFactor = 300000; 
            scale = Math.max(minScaleFactor, Math.min(maxScaleFactor, newScale));
            
            const worldAfterZoom_if_pan_did_not_change = {
                x: (mouseX_screen - panX) / scale, 
                y: -(mouseY_screen - panY) / scale  
            };

            panX += (worldAfterZoom_if_pan_did_not_change.x - worldBeforeZoom.x) * scale;
            panY += (worldAfterZoom_if_pan_did_not_change.y - worldBeforeZoom.y) * (-scale);

            mouse.x = mouseX_screen;
            mouse.y = mouseY_screen;
            const worldCoords = screenToWorld(mouse.x, mouse.y);
            mouse.worldX = worldCoords.x;
            mouse.worldY = worldCoords.y;
            const snapped = getSnappedCoordinates(worldCoords.x, worldCoords.y);
            mouse.snappedX = snapped.x;
            mouse.snappedY = snapped.y;

            draw();
        }


        function handleContextMenu(e) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const worldCoords = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            contextMenuTarget = findElementAt(worldCoords.x, worldCoords.y);

            if (contextMenuTarget) {
                deleteNodeItem.style.display = contextMenuTarget.type === 'node' ? 'block' : 'none';
                deleteLineItem.style.display = contextMenuTarget.type === 'line' ? 'block' : 'none';
                copyNodeItem.style.display = contextMenuTarget.type === 'node' ? 'block' : 'none';
                customContextMenu.style.left = `${e.clientX}px`;
                customContextMenu.style.top = `${e.clientY}px`;
                customContextMenu.classList.remove('hidden');
                tooltip.classList.add('hidden');
            } else {
                hideContextMenu();
            }
        }
        
        function handleClickOutsideContextMenu(e) {
            if (!customContextMenu.contains(e.target)) {
                hideContextMenu();
            }
        }

        function hideContextMenu() {
            customContextMenu.classList.add('hidden');
            contextMenuTarget = null;
        }

        // Element Interaction & Deletion
        function findNodeAt(worldX_currentUnit, worldY_currentUnit) {
            const clickRadiusWorld = 12 / scale; 
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i]; 
                const dist = Math.sqrt((node.x - worldX_currentUnit)**2 + (node.y - worldY_currentUnit)**2);
                if (dist < clickRadiusWorld) return node;
            }
            return null;
        }

        function findLineAt(worldX_currentUnit, worldY_currentUnit) {
            const clickRadiusWorld = 6 / scale;
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                const n1 = nodes.find(n => n.node_id === line.nodeId1); 
                const n2 = nodes.find(n => n.node_id === line.nodeId2); 
                if (n1 && n2) { 
                    const lenSq = (n1.x - n2.x)**2 + (n1.y - n2.y)**2; 
                    if (lenSq === 0) continue; 
                    let t = ((worldX_currentUnit - n1.x) * (n2.x - n1.x) + (worldY_currentUnit - n1.y) * (n2.y - n1.y)) / lenSq;
                    t = Math.max(0, Math.min(1, t));
                    const projX = n1.x + t * (n2.x - n1.x); 
                    const projY = n1.y + t * (n2.y - n1.y); 
                    const dist = Math.sqrt((worldX_currentUnit - projX)**2 + (worldY_currentUnit - projY)**2); 
                    if (dist < clickRadiusWorld) return line;
                }
            }
            return null;
        }

        function findBetaIconAt(worldX_currentUnit, worldY_currentUnit) {
            if (!showBetaAngleIcons) return null;
            for (const id in betaIconPositions) {
                const info = betaIconPositions[id];
                const half = info.size / 2;
                if (worldX_currentUnit >= info.x - half && worldX_currentUnit <= info.x + half &&
                    worldY_currentUnit >= info.y - half && worldY_currentUnit <= info.y + half) {
                    return lines.find(l => l.elem_id === parseInt(id));
                }
            }
            return null;
        }

        function findElementAt(worldX_currentUnit, worldY_currentUnit) {
            const node = findNodeAt(worldX_currentUnit, worldY_currentUnit);
            if (node) return { type: 'node', element: node };
            const line = findLineAt(worldX_currentUnit, worldY_currentUnit);
            if (line) return { type: 'line', element: line };
            return null;
        }

        function handleDeleteNode() {
            if (contextMenuTarget && contextMenuTarget.type === 'node') {
                const nodeIdToDelete = contextMenuTarget.element.node_id; 
                nodes = nodes.filter(node => node.node_id !== nodeIdToDelete); 
                lines = lines.filter(line => line.nodeId1 !== nodeIdToDelete && line.nodeId2 !== nodeIdToDelete);
                restrictions = restrictions.filter(res => res.node_id !== nodeIdToDelete);
				nodeLoads = nodeLoads.filter(load => load.target_id !== nodeIdToDelete);

                if (firstNodeForLine && firstNodeForLine.node_id === nodeIdToDelete) firstNodeForLine = null; 
                if (selectedNode && selectedNode.node_id === nodeIdToDelete) selectedNode = null; 
                hideContextMenu();
                updatePropertiesPanel(); 
                draw();
            }
        }

        function handleDeleteLine() {
             if (contextMenuTarget && contextMenuTarget.type === 'line') {
                lines = lines.filter(line => line.elem_id !== contextMenuTarget.element.elem_id);
                hideContextMenu();
                draw();
            }
        }

        function openCopyNodeModal() {
            if (contextMenuTarget && contextMenuTarget.type === 'node') {
                nodeToCopy = contextMenuTarget.element;
                copyNodeModal.classList.remove('hidden');
                hideContextMenu();
                tooltip.classList.add('hidden');
            }
        }

        function closeCopyNodeModal() {
            copyNodeModal.classList.add('hidden');
        }

        function applyCopyNode() {
            if (!nodeToCopy) { closeCopyNodeModal(); return; }
            let count = parseInt(copyCountInput.value, 10);
            if (isNaN(count) || count < 1) count = 2;
            if (count > 99) count = 99;
            const dist = parseFloat(copyDistanceInput.value) || 0;
            const axis = copyAxisSelect.value;
            for (let i = 1; i <= count; i++) {
                const newNode = {
                    node_id: nextNodeId++,
                    x: nodeToCopy.x + (axis === 'x' ? dist * i : 0),
                    y: nodeToCopy.y + (axis === 'y' ? dist * i : 0)
                };
                nodes.push(newNode);
            }
            closeCopyNodeModal();
            updatePropertiesPanel();
            draw();
        }

        function selectAllElements() {
            selectedElements = lines.map(line => ({ type: 'line', element: line }));
            selectedNode = null;
            firstNodeForLine = null;
            selectedElement = null;
            updatePropertiesPanel();
            draw();
        }

                function clearAll() {
            nodes = [];
            lines = [];
            restrictions = [];
            nodeLoads = [];
			elementLoads = [];
            nextNodeId = 1;
            nextElemId = 1;
            nextLoadId = 1;
			nextElementLoadId = 1;
            selectedNode = null;
            firstNodeForLine = null;
            selectedElement = null;
            updatePropertiesPanel();
            draw();
        }

        // Node Properties Panel Logic
        function updatePropertiesPanel() {
            const propertiesPanel = document.getElementById('propertiesPanel');
            const nodePropertiesContent = document.getElementById('nodePropertiesContent');

            if (selectedNode) {
                propertiesPanel.style.display = 'block';

                const currentForceDisplayUnit = forceUnitsSelect.value; 
                const currentLengthDisplayUnit = unitsSelect.value;
                const currentMomentDisplayUnit = currentForceDisplayUnit + '*' + currentLengthDisplayUnit;

                let loadsHtml = '';
                const nodeSpecificLoads = nodeLoads.filter(load => load.target_id === selectedNode.node_id);
                if (nodeSpecificLoads.length === 0) {
                    loadsHtml += '<p class="text-gray-500 text-xs font-light">No loads yet</p>';
                } else {
                    loadsHtml += '<div class="mb-2">';
                    nodeSpecificLoads.forEach(load => {
                        let displayedValue;
                        let displayedUnitString;

                        if (load.type === 'point_force') {
                            displayedValue = convertForce(load.value, load.unit, currentForceDisplayUnit).toFixed(2);
                            displayedUnitString = currentForceDisplayUnit;
                        } else if (load.type === 'moment') {
                            displayedValue = convertMoment(load.value, load.unit, load.lengthUnit, currentForceDisplayUnit, currentLengthDisplayUnit).toFixed(2);
                            displayedUnitString = currentMomentDisplayUnit;
                        }
                        
                        loadsHtml += `
                            <div class="load-item">
                                <span>${load.type === 'point_force' ? 'F' : 'M'}${load.component !== 'moment' ? load.component.toUpperCase() : ''}: ${displayedValue} ${displayedUnitString}</span>
                                <button data-load-id="${load.load_id}">Delete</button>
                            </div>
                        `;
                    });
                    loadsHtml += '</div>';
                }

                let currentRestriction = restrictions.find(r => r.node_id === selectedNode.node_id);
                if (!currentRestriction) {
                    currentRestriction = { dx: 0, dy: 0, dr: 0, type: "none" };
                }

                nodePropertiesContent.innerHTML = `
                    <h4 class="text-gray-700 mb-2">Node properties ${selectedNode.node_id}</h4>
                    <div class="property-group">
                        <div class="coordinates-row">
                            <label for="nodeX">X:</label>
                            <input type="number" id="nodeX" value="${selectedNode.x.toFixed(2)}">
                            <label for="nodeY">Y:</label>
                            <input type="number" id="nodeY" value="${selectedNode.y.toFixed(2)}">
                        </div>
                    </div>
                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Boundaries</h4>
                        <div class="restriction-grid">
                            <div id="restrictionIconsCol1" class="restriction-icons-col"></div>
                            <div id="restrictionIconsCol2" class="restriction-icons-col"></div>
                            <div class="restriction-checkboxes-col">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="restrictX" ${currentRestriction.dx === 1 ? 'checked' : ''}>
                                    <label for="restrictX">dx</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="restrictY" ${currentRestriction.dy === 1 ? 'checked' : ''}>
                                    <label for="restrictY">dy</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="restrictR" ${currentRestriction.dr === 1 ? 'checked' : ''}>
                                    <label for="restrictR">dr</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Loads</h4>
                        <div id="nodeLoadsList" class="mb-4">
                            ${loadsHtml} </div>
                        <div class="load-input-group">
                            <label for="addForceX" class="sr-only">Force X</label>
                            <input type="number" id="addForceX" placeholder="Fx">
                            <span id="currentForceUnitDisplay_Fx" class="ml-2"></span>
                            <button id="addForceXBtn">Add Fx</button>
                        </div>
                        <div class="load-input-group">
                            <label for="addForceY" class="sr-only">Force Y</label>
                            <input type="number" id="addForceY" placeholder="Fy">
                            <span id="currentForceUnitDisplay_Fy" class="ml-2"></span>
                            <button id="addForceYBtn">Add Fy</button>
                        </div>
                        <div class="load-input-group">
                            <label for="addMoment" class="sr-only">Moment</label>
                            <input type="number" id="addMoment" placeholder="M">
                            <span id="currentForceUnitDisplay_M" class="ml-2"></span>
                            <button id="addMomentBtn">Add M</button>
                        </div>
                    </div>
                `;

                const nodeXInput = document.getElementById('nodeX');
                const nodeYInput = document.getElementById('nodeY');

                const restrictXCheckbox = document.getElementById('restrictX');
                const restrictYCheckbox = document.getElementById('restrictY');
                const restrictRCheckbox = document.getElementById('restrictR');
                const restrictionIconsCol1 = document.getElementById('restrictionIconsCol1');
                const restrictionIconsCol2 = document.getElementById('restrictionIconsCol2');

                const nodeLoadsList = document.getElementById('nodeLoadsList');
                const addForceXInput = document.getElementById('addForceX');
                const addForceXBtn = document.getElementById('addForceXBtn');
                const addForceYInput = document.getElementById('addForceY');
                const addForceYBtn = document.getElementById('addForceYBtn');
                const addMomentInput = document.getElementById('addMoment');
                const addMomentBtn = document.getElementById('addMomentBtn');

                nodeXInput.value = selectedNode.x.toFixed(3);
                nodeYInput.value = selectedNode.y.toFixed(3);

                nodeXInput.addEventListener('change', (e) => {
                    const newValue = parseFloat(e.target.value);
                    if (!isNaN(newValue)) {
                        selectedNode.x = newValue;
                        draw();
                    }
                });

                nodeYInput.addEventListener('change', (e) => {
                    const newValue = parseFloat(e.target.value);
                    if (!isNaN(newValue)) {
                        selectedNode.y = newValue;
                        draw();
                    }
                });

                const updateRestriction = () => {
                    let updated = false;
                    restrictions = restrictions.filter(r => {
                        if (r.node_id === selectedNode.node_id) {
                            r.dx = restrictXCheckbox.checked ? 1 : 0;
                            r.dy = restrictYCheckbox.checked ? 1 : 0;
                            r.dr = restrictRCheckbox.checked ? 1 : 0;
                            updated = true;
                            if (r.dx === 0 && r.dy === 0 && r.dr === 0) {
                                return false;
                            }
                        }
                        return true;
                    });

                    if (!updated && (restrictXCheckbox.checked || restrictYCheckbox.checked || restrictRCheckbox.checked)) {
                        restrictions.push({
                            node_id: selectedNode.node_id,
                            dx: restrictXCheckbox.checked ? 1 : 0,
                            dy: restrictYCheckbox.checked ? 1 : 0,
                            dr: restrictRCheckbox.checked ? 1 : 0
                        });
                    }
                    draw();
                    renderRestrictionIcons();
                };

                restrictXCheckbox.addEventListener('change', updateRestriction);
                restrictYCheckbox.addEventListener('change', updateRestriction);
                restrictRCheckbox.addEventListener('change', updateRestriction);

                const renderRestrictionIcons = () => {
                    restrictionIconsCol1.innerHTML = '';
                    restrictionIconsCol2.innerHTML = '';

                    currentRestriction = restrictions.find(r => r.node_id === selectedNode.node_id);
                    if (!currentRestriction) {
                        currentRestriction = { dx: 0, dy: 0, dr: 0, type: "none" };
                    }

                    const buttons = [];

                    const noRestrictionBtn = document.createElement('button');
                    noRestrictionBtn.className = `restriction-icon-btn ${currentRestriction.dx === 0 && currentRestriction.dy === 0 && currentRestriction.dr === 0 ? 'active' : ''}`;
                    noRestrictionBtn.innerHTML = '<span class="no-restriction-text">Ø</span>';
                    noRestrictionBtn.title = 'No boundaries yet';
                    noRestrictionBtn.addEventListener('click', () => {
                        restrictions = restrictions.filter(r => r.node_id !== selectedNode.node_id);
                        restrictXCheckbox.checked = false;
                        restrictYCheckbox.checked = false;
                        restrictRCheckbox.checked = false;
                        updateRestriction();
                    });
                    buttons.push(noRestrictionBtn);

                    for (const typeKey in restrictionTypes) {
                        const type = restrictionTypes[typeKey];
                        if (type.icon) {
                            const btn = document.createElement('button');
                            btn.className = `restriction-icon-btn ${currentRestriction.dx === type.dx && currentRestriction.dy === type.dy && currentRestriction.dr === type.dr ? 'active' : ''}`;
                            btn.innerHTML = `<img src="icons/${type.icon}" alt="${type.label}" title="${type.label}">`;
                            btn.title = type.label;
                            btn.addEventListener('click', () => {
                                restrictions = restrictions.filter(r => r.node_id !== selectedNode.node_id);
                                restrictions.push({
                                    node_id: selectedNode.node_id,
                                    dx: type.dx,
                                    dy: type.dy,
                                    dr: type.dr
                                });
                                restrictXCheckbox.checked = type.dx === 1;
                                restrictYCheckbox.checked = type.dy === 1;
                                restrictRCheckbox.checked = type.dr === 1;
                                updateRestriction();
                            });
                            buttons.push(btn);
                        }
                    }

                    buttons.slice(0, 4).forEach(btn => restrictionIconsCol1.appendChild(btn));
                    buttons.slice(4).forEach(btn => restrictionIconsCol2.appendChild(btn));
                };

                renderRestrictionIcons();

                const renderNodeLoads = () => {
                    nodeLoadsList.innerHTML = '';
                    const loadsForSelectedNode = nodeLoads.filter(load => load.target_id === selectedNode.node_id);

                    if (loadsForSelectedNode.length === 0) {
                        nodeLoadsList.innerHTML = '<p class="text-gray-500 text-xs font-light">No loads yet</p>';
                    } else {
                        const currentForceDisplayUnit = forceUnitsSelect.value;
                        const currentLengthDisplayUnit = unitsSelect.value;
                        const currentMomentDisplayUnit = currentForceDisplayUnit + '*' + currentLengthDisplayUnit;

                        nodeLoadsList.innerHTML = '';
                        loadsForSelectedNode.forEach(load => {
                            let displayedValue;
                            let displayedUnitString;

                            if (load.type === 'point_force') {
                                displayedValue = convertForce(load.value, load.unit, currentForceDisplayUnit).toFixed(2);
                                displayedUnitString = currentForceDisplayUnit;
                            } else if (load.type === 'moment') {
                                displayedValue = convertMoment(load.value, load.unit, load.lengthUnit, currentForceDisplayUnit, currentLengthDisplayUnit).toFixed(2);
                                displayedUnitString = currentMomentDisplayUnit;
                            }
                            
                            let loadLabel = '';
                            switch (load.type) {
                                case 'point_force':
                                    loadLabel = `F${load.component.toUpperCase()}: ${displayedValue} ${displayedUnitString}`; 
                                    break;
                                case 'moment':
                                    loadLabel = `M: ${displayedValue} ${displayedUnitString}`; 
                                    break;
                            }

                            const loadItemDiv = document.createElement('div');
                            loadItemDiv.className = 'load-item';
                            loadItemDiv.innerHTML = `
                                <span>${loadLabel}</span>
                                <button data-load-id="${load.load_id}">Удалить</button>
                            `;
                            nodeLoadsList.appendChild(loadItemDiv);
                        });

                        nodeLoadsList.querySelectorAll('.load-item button').forEach(button => {
                            button.addEventListener('click', (e) => {
                                const loadIdToDelete = parseInt(e.target.dataset.loadId);
                                nodeLoads = nodeLoads.filter(load => load.load_id !== loadIdToDelete);
                                renderNodeLoads();
                                draw();
                            });
                        });
                    }
                };

                renderNodeLoads();

                addForceXBtn.addEventListener('click', () => {
                    const value = parseFloat(addForceXInput.value);
                    if (!isNaN(value)) {
                        nodeLoads.push({
                            load_id: nextLoadId++,
                            type: 'point_force',
                            target_id: selectedNode.node_id,
                            component: 'x',
                            value: value,
                            unit: forceUnitsSelect.value
                        });
                        addForceXInput.value = '';
                        renderNodeLoads();
                        draw();
                    }
                });

                addForceYBtn.addEventListener('click', () => {
                    const value = parseFloat(addForceYInput.value);
                    if (!isNaN(value)) {
                        nodeLoads.push({
                            load_id: nextLoadId++,
                            type: 'point_force',
                            target_id: selectedNode.node_id,
                            component: 'y',
                            value: value,
                            unit: forceUnitsSelect.value
                        });
                        addForceYInput.value = '';
                        renderNodeLoads();
                        draw();
                    }
                });

                addMomentBtn.addEventListener('click', () => {
                    const value = parseFloat(addMomentInput.value);
                    if (!isNaN(value)) {
                        nodeLoads.push({
                            load_id: nextLoadId++,
                            type: 'moment',
                            target_id: selectedNode.node_id,
                            component: 'r',
                            value: value,
                            unit: forceUnitsSelect.value,
                            lengthUnit: unitsSelect.value
                        });
                        addMomentInput.value = '';
                        renderNodeLoads();
                        draw();
                    }
                });

			} else if (selectedElement) {
                propertiesPanel.style.display = 'block';

                const currentForceDisplayUnit = forceUnitsSelect.value;
                const currentLengthDisplayUnit = unitsSelect.value;
                const currentMomentDisplayUnit = `${currentForceDisplayUnit}*${currentLengthDisplayUnit}`;
                const currentDistributedForceUnit = `${currentForceDisplayUnit}/${currentLengthDisplayUnit}`;
				
                // --- Формирование опций для выпадающего списка материалов ---
                let materialOptionsHtml = '<option value="">Not selected</option>'; // Опция по умолчанию
                modelMaterials.forEach(mat => {
                    // Проверяем, назначен ли этот материал текущему элементу
                    const isSelected = selectedElement.materialId === mat.id ? 'selected' : '';
                    materialOptionsHtml += `<option value="${mat.id}" ${isSelected}>${mat.name} (${mat.standard})</option>`;
                });

                // --- Получаем имя назначенного материала для отображения ---
                let assignedMaterialName = 'No materials yet';
                if (selectedElement.materialId) {
                    const assignedMat = modelMaterials.find(m => m.id === selectedElement.materialId);
                    if (assignedMat) {
                        assignedMaterialName = `${assignedMat.name} (${assignedMat.standard})`;
                    }
                }

                // --- Формирование опций для выпадающего списка сечений ---
                let sectionOptionsHtml = '<option value="">Not selected</option>';
                modelSections.forEach(sec => {
                    const isSelected = selectedElement.sectionId === sec.id ? 'selected' : '';
                    sectionOptionsHtml += `<option value="${sec.id}" ${isSelected}>${sec.name} (${sec.standard})</option>`;
                });

                // --- Имя назначенного сечения ---
                let assignedSectionName = 'No sections yet';
                if (selectedElement.sectionId) {
                    const assignedSec = modelSections.find(s => s.id === selectedElement.sectionId);
                    if (assignedSec) {
                        assignedSectionName = `${assignedSec.name} (${assignedSec.standard})`;
                    }
                }
                const betaAngleValue = selectedElement.betaAngle !== undefined ? selectedElement.betaAngle : 0;

                let loadsHtml = '';
                const elementSpecificLoads = elementLoads.filter(load => load.target_elem_id === selectedElement.elem_id);
                if (elementSpecificLoads.length === 0) {
                    loadsHtml += '<p class="text-gray-500 text-xs font-light">No loads yet</p>';
                } else {
                    loadsHtml += '<div class="mb-2">';
                    elementSpecificLoads.forEach(load => {
                        let displayedValue;
                        let displayedUnitString;
						
                        const storedForceUnit = load.unit.split('/')[0];
                        const storedLengthUnit = load.unit.split('/')[1];
						
                        const targetForceUnit = currentDistributedForceUnit.split('/')[0];
                        const targetLengthUnit = currentDistributedForceUnit.split('/')[1];
						
                        if (isNaN(load.startValue)) {
                            displayedValue = "NaN";
                        } else {
                            displayedValue = convertDistributedForce(load.startValue, storedForceUnit, storedLengthUnit, targetForceUnit, targetLengthUnit).toFixed(5);
                        }
                        displayedUnitString = currentDistributedForceUnit;

                        loadsHtml += `
                            <div class="load-item">
                                <span>q${load.component.toUpperCase()}: ${displayedValue} ${displayedUnitString}</span>
                                <button data-load-id="${load.load_id}" data-load-type="distributed">Delete</button>
                            </div>
                        `;
                    });
                    loadsHtml += '</div>';
                }

                // НОВЫЙ ВНУТРЕННИЙ HTML ДЛЯ ПАНЕЛИ СВОЙСТВ ЭЛЕМЕНТА
                nodePropertiesContent.innerHTML = `
                    <h4 class="text-gray-700 mb-2">Rod properties ${selectedElement.elem_id}</h4>
                    <div class="property-group">
                        <p>Start node: ${selectedElement.nodeId1}</p>
                        <p>End node: ${selectedElement.nodeId2}</p>
                    </div>

                    <!-- НОВАЯ СЕКЦИЯ: Назначение материала -->
                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Material</h4>
                        <div class="flex items-center gap-2 mb-2">
                            <select id="materialAssignmentSelect" class="flex-grow">
                                ${materialOptionsHtml}
                            </select>
                            <button id="assignMaterialBtn">Apply</button>
                        </div>
                        <p class="text-xs text-gray-700 font-light">Assigned material: <span id="assignedMaterialDisplay">${assignedMaterialName}</span></p>
                    </div>

                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Section</h4>
                        <div class="flex items-center gap-2 mb-2">
                            <select id="sectionAssignmentSelect" class="flex-grow">
                                ${sectionOptionsHtml}
                            </select>
                            <button id="assignSectionBtn">Apply</button>
                        </div>
                        <div class="flex items-center gap-2 mb-2">
                            <select id="betaAngleSelect">
                                <option value="0">0</option>
                                <option value="90">90</option>
                                <option value="180">180</option>
                                <option value="270">270</option>
                            </select>
                            <button id="changeBetaAngleBtn">Apply</button>
                        </div>
                        <p class="text-xs text-gray-700 font-light">Assigned section: <span id="assignedSectionDisplay">${assignedSectionName}</span></p>
                        <p class="text-xs text-gray-700 font-light mt-1">Section rotation: <span id="betaAngleDisplay">${betaAngleValue}</span></p>
                    </div>

                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Beam loads</h4>
                        <div id="elementLoadsList" class="mb-4">
                            ${loadsHtml}
                        </div>
                        <div class="load-input-group">
                            <label for="addDistributedForceX" class="sr-only">Uniform load X</label>
                            <input type="number" id="addDistributedForceX" placeholder="qX">
                            <span id="currentDistributedForceUnitDisplay_qX" class="ml-2">${currentDistributedForceUnit}</span>
                            <button id="addDistributedForceXBtn">Add qX</button>
                        </div>
                        <div class="load-input-group">
                            <label for="addDistributedForceY" class="sr-only">Uniform load Y</label>
                            <input type="number" id="addDistributedForceY" placeholder="qY">
                            <span id="currentDistributedForceUnitDisplay_qY" class="ml-2">${currentDistributedForceUnit}</span>
                            <button id="addDistributedForceYBtn">Add qY</button>
                        </div>
                    </div>
                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Split the rod</h4>
                        <div class="flex items-center space-x-2 mb-2">
                            <input type="number" id="splitSegmentsInput" value="2" min="2">
                            <button id="splitElementBtn">Split</button>
                        </div>
                    </div>
                `;

                const elementLoadsList = document.getElementById('elementLoadsList');
                const addDistributedForceXInput = document.getElementById('addDistributedForceX');
                const addDistributedForceXBtn = document.getElementById('addDistributedForceXBtn');
                const addDistributedForceYInput = document.getElementById('addDistributedForceY');
                const addDistributedForceYBtn = document.getElementById('addDistributedForceYBtn');

                const renderElementLoads = () => {
                    elementLoadsList.innerHTML = '';
                    const loadsForSelectedElement = elementLoads.filter(load => load.target_elem_id === selectedElement.elem_id);

                    if (loadsForSelectedElement.length === 0) {
                        elementLoadsList.innerHTML = '<p class="text-gray-500 text-xs font-light">No loads yet</p>';
                    } else {
                        const currentForceDisplayUnit = forceUnitsSelect.value;
                        const currentLengthDisplayUnit = unitsSelect.value;
                        const currentDistributedForceUnit = `${currentForceDisplayUnit}/${currentLengthDisplayUnit}`;

                        loadsForSelectedElement.forEach(load => {
                            const storedForceUnit = load.unit.split('/')[0];
                            const storedLengthUnit = load.unit.split('/')[1];
                            const targetForceUnit = currentDistributedForceUnit.split('/')[0];
                            const targetLengthUnit = currentDistributedForceUnit.split('/')[1];

                            const displayedValue = parseFloat(convertDistributedForce(load.startValue, storedForceUnit, storedLengthUnit, targetForceUnit, targetLengthUnit).toFixed(3));
                            const displayedUnitString = currentDistributedForceUnit;
                            
                            const loadItemDiv = document.createElement('div');
                            loadItemDiv.className = 'load-item';
                            loadItemDiv.innerHTML = `
                                <span>q${load.component.toUpperCase()}: ${displayedValue} ${displayedUnitString}</span>
                                <button data-load-id="${load.load_id}" data-load-type="distributed">Delete</button>
                            `;
                            elementLoadsList.appendChild(loadItemDiv);
                        });

                        elementLoadsList.querySelectorAll('.load-item button').forEach(button => {
                            button.addEventListener('click', (e) => {
                                const loadIdToDelete = parseInt(e.target.dataset.loadId);
                                elementLoads = elementLoads.filter(load => load.load_id !== loadIdToDelete);
                                renderElementLoads();
                                draw();
                            });
                        });
                    }
                };

                renderElementLoads();

                addDistributedForceXBtn.addEventListener('click', () => {
                    const value = parseFloat(addDistributedForceXInput.value);
                    if (!isNaN(value)) {
                        elementLoads.push({
                            load_id: nextElementLoadId++,
                            target_elem_id: selectedElement.elem_id,
                            type: 'uniform', 
                            component: 'x',
                            startValue: value,
                            endValue: value,
                            unit: `${forceUnitsSelect.value}/${unitsSelect.value}`,
                            startPosition: 0, 
                            endPosition: 1 
                        });
                        addDistributedForceXInput.value = '';
                        renderElementLoads();
                        draw();
                    }
                });

                addDistributedForceYBtn.addEventListener('click', () => {
                    const value = parseFloat(addDistributedForceYInput.value);
                    if (!isNaN(value)) {
                        elementLoads.push({
                            load_id: nextElementLoadId++,
                            target_elem_id: selectedElement.elem_id,
                            type: 'uniform',
                            component: 'y',
                            startValue: value,
                            endValue: value,
                            unit: `${forceUnitsSelect.value}/${unitsSelect.value}`,
                            startPosition: 0, 
                            endPosition: 1 
                        });
                        addDistributedForceYInput.value = '';
                        renderElementLoads();
                        draw();
                    }
                });
				
                const splitSegmentsInput = document.getElementById('splitSegmentsInput');
                const splitElementBtn = document.getElementById('splitElementBtn');
				
                // НОВЫЕ: Получаем ссылки на элементы для назначения материала
                const materialAssignmentSelect = document.getElementById('materialAssignmentSelect');
                const assignMaterialBtn = document.getElementById('assignMaterialBtn');
                const assignedMaterialDisplay = document.getElementById('assignedMaterialDisplay');
                const sectionAssignmentSelect = document.getElementById('sectionAssignmentSelect');
                const assignSectionBtn = document.getElementById('assignSectionBtn');
                const betaAngleSelect = document.getElementById('betaAngleSelect');
                const changeBetaAngleBtn = document.getElementById('changeBetaAngleBtn');

                if (betaAngleSelect) {
                    betaAngleSelect.value = String(betaAngleValue);
                }
                const assignedSectionDisplay = document.getElementById('assignedSectionDisplay');

                // НОВОЕ: Добавляем слушатель для кнопки "Выбрать"
                if (assignMaterialBtn && selectedElement) { // Проверяем, что кнопка и элемент существуют
                    // Удаляем старый слушатель, чтобы избежать дублирования при перерисовке панели
                    // Создаем анонимную функцию-обертку для слушателя
                    // Это позволяет нам иметь уникальный слушатель для каждого рендера панели
                    // и при этом безопасно его добавлять без риска дублирования.
                    // Для более сложных сценариев можно использовать .removeEventListener
                    // с именованной функцией, но для динамически генерируемых элементов
                    // это подходит.
                    assignMaterialBtn.onclick = () => { // Используем onclick вместо addEventListener для простоты перезаписи
                        const newMaterialId = materialAssignmentSelect.value;

                        if (selectedElement) {
                            // Если пользователь выбрал пустую опцию "Не выбрано"
                            if (newMaterialId === "") {
                                selectedElement.materialId = null; // Сброс назначенного материала
                                console.log(`Материал для элемента ${selectedElement.elem_id} сброшен.`);
                            } else {
                                // Назначаем новый материал
                                selectedElement.materialId = newMaterialId;
                                const assignedMat = modelMaterials.find(m => m.id === newMaterialId);
                                if (assignedMat) {
                                    console.log(`Материал "${assignedMat.name}" назначен элементу ${selectedElement.elem_id}.`);
                                } else {
                                    console.warn(`Выбранный материал ID "${newMaterialId}" не найден в modelMaterials.`);
                                }
                            }
                            
                            // Обновляем панель свойств, чтобы отобразить изменения
                            updatePropertiesPanel();
                            // Перерисовываем канвас, если есть какая-либо визуализация материала
                            draw();
                        }
                    };
                }

                if (assignSectionBtn && selectedElement) {
                    assignSectionBtn.onclick = () => {
                        const newSectionId = sectionAssignmentSelect.value;
                        if (selectedElement) {
                            if (newSectionId === "") {
                                selectedElement.sectionId = null;
                                console.log(`Сечение для элемента ${selectedElement.elem_id} сброшено.`);
                            } else {
                                selectedElement.sectionId = newSectionId;
                                const assignedSec = modelSections.find(s => s.id === newSectionId);
                                if (assignedSec) {
                                    console.log(`Сечение "${assignedSec.name}" назначено элементу ${selectedElement.elem_id}.`);
                                } else {
                                    console.warn(`Выбранное сечение ID "${newSectionId}" не найдено в modelSections.`);
                                }
                            }
                            updatePropertiesPanel();
                            draw();
                        }
                    };
                }

                if (changeBetaAngleBtn && selectedElement) {
                    changeBetaAngleBtn.onclick = () => {
                        const angle = parseInt(betaAngleSelect.value, 10);
                        if (!isNaN(angle)) {
                            selectedElement.betaAngle = angle;
                            updatePropertiesPanel();
                            draw();
                        }
                    };
                }

                splitElementBtn.addEventListener('click', () => {
                    if (!selectedElement) return;

                    const numSegments = parseInt(splitSegmentsInput.value, 10);
                    if (isNaN(numSegments) || numSegments < 2) {
                        console.error("Некорректное количество участков для разбиения. Должно быть не менее 2.");
                        return;
                    }

                    const originalLine = selectedElement;
                    const node1 = nodes.find(n => n.node_id === originalLine.nodeId1);
                    const node2 = nodes.find(n => n.node_id === originalLine.nodeId2);

                    if (!node1 || !node2) {
                        console.error("Не найдены узлы для выбранного элемента.");
                        return;
                    }

                    lines = lines.filter(line => line.elem_id !== originalLine.elem_id);
                    console.log(`Удален стержень с ID: ${originalLine.elem_id}`);

                    elementLoads = elementLoads.filter(load => load.target_elem_id === originalLine.elem_id);
                    console.log(`Удалены равномерно-распределенные нагрузки для стержня ${originalLine.elem_id}`);

                    const newNodes = [];
                    const newLines = [];
                    
                    const dx = node2.x - node1.x;
                    const dy = node2.y - node1.y;

                    for (let i = 1; i < numSegments; i++) {
                        const ratio = i / numSegments;
                        const newNodeX = node1.x + dx * ratio;
                        const newNodeY = node1.y + dy * ratio;

                        const newNode = { 
                            node_id: nextNodeId++, 
                            x: newNodeX, 
                            y: newNodeY 
                        };
                        newNodes.push(newNode);
                        console.log(`Добавлен новый узел ${newNode.node_id} по координатам (${newNode.x.toFixed(3)}, ${newNode.y.toFixed(3)})`);
                    }

                    const allSegmentNodes = [node1, ...newNodes, node2]; 

                    for (let i = 0; i < allSegmentNodes.length - 1; i++) {
                        const startNode = allSegmentNodes[i];
                        const endNode = allSegmentNodes[i + 1];

                        const newLine = {
                            elem_id: nextElemId++,
                            nodeId1: startNode.node_id,
                            nodeId2: endNode.node_id,
                            structural_type: originalLine.structural_type || 'beam',
                            materialId: originalLine.materialId || null,
                            sectionId: originalLine.sectionId || null,
                            betaAngle: originalLine.betaAngle || 0
                        };
                        newLines.push(newLine);
                        console.log(`Добавлен новый стержень ${newLine.elem_id} между узлами ${startNode.node_id} и ${endNode.node_id}`);
                    }

                    nodes.push(...newNodes);
                    lines.push(...newLines);

                    selectedElement = null;
                    selectedNode = null;
                    firstNodeForLine = null;

                    updatePropertiesPanel();
                    draw();
                });

            } else if (selectedElements.length > 1 && selectedElements.every(el => el.type === 'line')) {
                propertiesPanel.style.display = 'block';
                let materialOptionsHtml = '<option value="">Not selected</option>';
                modelMaterials.forEach(mat => {
                    materialOptionsHtml += `<option value="${mat.id}">${mat.name} (${mat.standard})</option>`;
                });

                const materialIds = selectedElements.map(sel => sel.element.materialId !== undefined ? sel.element.materialId : null);
                const uniqueMaterialIds = new Set(materialIds);
                let assignedMaterialName;
                if (uniqueMaterialIds.size === 1) {
                    const soleId = Array.from(uniqueMaterialIds)[0];
                    if (soleId === null) {
                        assignedMaterialName = 'Нет';
                    } else {
                        const mat = modelMaterials.find(m => m.id === soleId);
                        assignedMaterialName = mat ? `${mat.name} (${mat.standard})` : 'Нет';
                    }
                } else {
                    assignedMaterialName = 'varios';
                }

                let sectionOptionsHtml = '<option value="">Not selected</option>';
                modelSections.forEach(sec => {
                    sectionOptionsHtml += `<option value="${sec.id}">${sec.name} (${sec.standard})</option>`;
                });

                const sectionIds = selectedElements.map(sel => sel.element.sectionId !== undefined ? sel.element.sectionId : null);
                const uniqueSectionIds = new Set(sectionIds);
                let assignedSectionName;
                if (uniqueSectionIds.size === 1) {
                    const soleId = Array.from(uniqueSectionIds)[0];
                    if (soleId === null) {
                        assignedSectionName = 'Нет';
                    } else {
                        const sec = modelSections.find(s => s.id === soleId);
                        assignedSectionName = sec ? `${sec.name} (${sec.standard})` : 'No name';
                    }
                } else {
                    assignedSectionName = 'various';
                }

                const uniqueAngles = new Set(selectedElements.map(sel => sel.element.betaAngle !== undefined ? sel.element.betaAngle : 0));
                const betaAngleDisplay = uniqueAngles.size === 1 ? Array.from(uniqueAngles)[0] : 'various';

                const currentForceDisplayUnit = forceUnitsSelect.value;
                const currentLengthDisplayUnit = unitsSelect.value;
                const currentDistributedForceUnit = `${currentForceDisplayUnit}/${currentLengthDisplayUnit}`;
                nodePropertiesContent.innerHTML = `
                    <h4 class="text-gray-700 mb-2">Selected rods: ${selectedElements.length}</h4>
                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Material</h4>
                        <div class="flex items-center gap-2 mb-2">
                            <select id="multiMaterialSelect" class="flex-grow">
                                ${materialOptionsHtml}
                            </select>
                            <button id="applyMaterialToSelectedBtn">Apply</button>
                        </div>
                        <p class="text-xs text-gray-700 font-light">Assigned material: <span id="multiAssignedMaterialDisplay">${assignedMaterialName}</span></p>
                    </div>
                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Section</h4>
                        <div class="flex items-center gap-2 mb-2">
                            <select id="multiSectionSelect" class="flex-grow">
                                ${sectionOptionsHtml}
                            </select>
                            <button id="applySectionToSelectedBtn">Apply</button>
                        </div>
                        <div class="flex items-center gap-2 mb-2">
                            <select id="multiBetaAngleSelect">
                                <option value="0">0</option>
                                <option value="90">90</option>
                                <option value="180">180</option>
                                <option value="270">270</option>
                            </select>
                            <button id="applyBetaAngleToSelectedBtn">Apply</button>
                        </div>
                        <p class="text-xs text-gray-700 font-light">Section: <span id="multiAssignedSectionDisplay">${assignedSectionName}</span></p>
                        <p class="text-xs text-gray-700 font-light mt-1">Section rotation: <span id="multiBetaAngleDisplay">${betaAngleDisplay}</span></p>
                    </div>
                    <div class="property-group">
                        <h4 class="text-gray-700 mb-2">Beam loads</h4>
                        <div class="load-input-group">
                            <label for="multiDistributedForceX" class="sr-only">Uniform load X</label>
                            <input type="number" id="multiDistributedForceX" placeholder="qX">
                            <span id="currentDistributedForceUnitDisplay_multi_qX" class="ml-2">${currentDistributedForceUnit}</span>
                            <button id="multiDistributedForceXBtn">Add qX</button>
                        </div>
                        <div class="load-input-group">
                            <label for="multiDistributedForceY" class="sr-only">Uniform load Y</label>
                            <input type="number" id="multiDistributedForceY" placeholder="qY">
                            <span id="currentDistributedForceUnitDisplay_multi_qY" class="ml-2">${currentDistributedForceUnit}</span>
                            <button id="multiDistributedForceYBtn">Add qY</button>
                        </div>
                    </div>
                `;

                const applyBtn = document.getElementById('applyMaterialToSelectedBtn');
                const selectEl = document.getElementById('multiMaterialSelect');
                if (applyBtn && selectEl) {
                    applyBtn.addEventListener('click', () => {
                        const matId = selectEl.value;
                        selectedElements.forEach(sel => {
                            if (sel.type === 'line') {
                                sel.element.materialId = matId || null;
                            }
                        });
                        updatePropertiesPanel();
                        draw();
                    });
                }

                const applySectionBtn = document.getElementById('applySectionToSelectedBtn');
                const sectionSelectEl = document.getElementById('multiSectionSelect');
                if (applySectionBtn && sectionSelectEl) {
                    applySectionBtn.addEventListener('click', () => {
                        const secId = sectionSelectEl.value;
                        selectedElements.forEach(sel => {
                            if (sel.type === 'line') {
                                sel.element.sectionId = secId || null;
                            }
                        });
                        updatePropertiesPanel();
                        draw();
                    });
                }

                const applyBetaBtn = document.getElementById('applyBetaAngleToSelectedBtn');
                const betaSelectEl = document.getElementById('multiBetaAngleSelect');

                if (betaSelectEl) {
                    if (uniqueAngles.size === 1) {
                        betaSelectEl.value = String(Array.from(uniqueAngles)[0]);
                    }
                }

                if (applyBetaBtn && betaSelectEl) {
                    applyBetaBtn.addEventListener('click', () => {
                        const angle = parseInt(betaSelectEl.value, 10);
                        if (!isNaN(angle)) {
                            selectedElements.forEach(sel => {
                                if (sel.type === 'line') {
                                    sel.element.betaAngle = angle;
                                }
                            });
                            updatePropertiesPanel();
                            draw();
                        }
                    });
                }

                const multiLoadXInput = document.getElementById('multiDistributedForceX');
                const multiLoadXBtn = document.getElementById('multiDistributedForceXBtn');
                const multiLoadYInput = document.getElementById('multiDistributedForceY');
                const multiLoadYBtn = document.getElementById('multiDistributedForceYBtn');

                if (multiLoadXBtn && multiLoadXInput) {
                    multiLoadXBtn.addEventListener('click', () => {
                        const value = parseFloat(multiLoadXInput.value);
                        if (!isNaN(value)) {
                            selectedElements.forEach(sel => {
                                if (sel.type === 'line') {
                                    elementLoads.push({
                                        load_id: nextElementLoadId++,
                                        target_elem_id: sel.element.elem_id,
                                        type: 'uniform',
                                        component: 'x',
                                        startValue: value,
                                        endValue: value,
                                        unit: `${forceUnitsSelect.value}/${unitsSelect.value}`,
                                        startPosition: 0,
                                        endPosition: 1
                                    });
                                }
                            });
                            multiLoadXInput.value = '';
                            updatePropertiesPanel();
                            draw();
                        }
                    });
                }

                if (multiLoadYBtn && multiLoadYInput) {
                    multiLoadYBtn.addEventListener('click', () => {
                        const value = parseFloat(multiLoadYInput.value);
                        if (!isNaN(value)) {
                            selectedElements.forEach(sel => {
                                if (sel.type === 'line') {
                                    elementLoads.push({
                                        load_id: nextElementLoadId++,
                                        target_elem_id: sel.element.elem_id,
                                        type: 'uniform',
                                        component: 'y',
                                        startValue: value,
                                        endValue: value,
                                        unit: `${forceUnitsSelect.value}/${unitsSelect.value}`,
                                        startPosition: 0,
                                        endPosition: 1
                                    });
                                }
                            });
                            multiLoadYInput.value = '';
                            updatePropertiesPanel();
                            draw();
                        }
                    });
                }

            } else {
                propertiesPanel.style.display = 'block';
                nodePropertiesContent.innerHTML = '<p>Select a node or rod to view its properties</p>';
            }
        }
		
        // ====================================================================
        // Материалы: Функции загрузки, отображения и выбора
        // ====================================================================

        let allMaterialsData = {}; // Объект для хранения всех загруженных данных материалов
        let standardsData = []; // Массив для хранения данных стандартов
        let userMaterials = []; // Глобальная переменная для пользовательских материалов

        // --- Сечения ---
        let allSectionsData = {}; // Объект для хранения всех загруженных данных сечений
		
		// НОВОЕ: Массив для хранения материалов, добавленных в текущую модель
        let modelMaterials = [];
        let modelSections = [];

        // Основная функция для загрузки всех данных материалов
        async function loadAllMaterials() {
            try {
                // Сначала загружаем файл стандартов (standards.json)
                const standardsResponse = await fetch('data/standards.json');
                if (!standardsResponse.ok) {
                    throw new Error(`HTTP error! status: ${standardsResponse.status}`);
                }
                standardsData = await standardsResponse.json();
                console.log("Loaded standards.json:", standardsData);

                // Теперь загружаем материалы для каждого стандарта
                for (const standard of standardsData) {
                    // ЕСЛИ materialFile равен "localStorage", используем локальное хранилище
                    if (standard.materialFile === "localStorage") {
                        userMaterials = loadUserMaterialsFromLocalStorage();
                        allMaterialsData[standard.id] = userMaterials;
                        console.log(`Loaded user materials from localStorage for standard ${standard.id}:`, userMaterials);
                    } else {
                        // В противном случае, загружаем файл JSON по указанному пути
                        const filePath = standard.materialFile; 
                        if (!filePath) {
                            console.warn(`Warning: 'materialFile' property not found for standard '${standard.id}'. Skipping this standard.`);
                            continue; // Пропускаем, если путь к файлу не указан
                        }

                        const response = await fetch(filePath); 
                        if (!response.ok) {
                            // Если файл не найден, выводим предупреждение, но не останавливаем загрузку других стандартов
                            console.warn(`Warning: Material file ${filePath} not found or could not be loaded. Skipping this standard.`);
                            continue; 
                        }
                        const data = await response.json();
                        allMaterialsData[standard.id] = data; 
                        console.log(`Loaded ${filePath}:`, data);
                    }
                }

            } catch (error) {
                console.error("Error during initial loading of materials or standards data:", error);
            }
        }

        // Функция для загрузки пользовательских материалов из localStorage
        function loadUserMaterialsFromLocalStorage() {
            try {
                const storedMaterials = localStorage.getItem('userMaterials');
                // Возвращаем распарсенный JSON, или пустой массив, если ничего нет
                return storedMaterials ? JSON.parse(storedMaterials) : [];
            } catch (error) {
                console.error("Error loading user materials from localStorage:", error);
                return []; // Возвращаем пустой массив в случае ошибки
            }
        }

        // Функция для сохранения пользовательских материалов в localStorage
        function saveUserMaterialsToLocalStorage(materials) {
            try {
                localStorage.setItem('userMaterials', JSON.stringify(materials));
                console.log("User materials saved to localStorage:", materials);
            } catch (error) {
                console.error("Error saving user materials to localStorage:", error);
            }
        }

        // НОВАЯ ФУНКЦИЯ: Заполняет выпадающий список "Тип материала"
        // Убедитесь, что эта функция существует как отдельный блок кода!
        function populateMaterialTypeSelect() {
            if (!materialTypeSelect) { // materialTypeSelect должен быть глобально объявлен
                console.error("materialTypeSelect not found. Cannot populate material types.");
                return;
            }

            materialTypeSelect.innerHTML = ''; // Очищаем текущие опции

            // Добавляем опцию "Выберите тип"
            let defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Выберите тип";
            defaultOption.disabled = true; // Сделать невыбираемым
            defaultOption.selected = true; // Сделать выбранным по умолчанию
            materialTypeSelect.appendChild(defaultOption);

            // Собираем уникальные типы материалов из всех загруженных данных
            const uniqueTypes = new Set();
            for (const standardId in allMaterialsData) {
                if (allMaterialsData.hasOwnProperty(standardId)) {
                    allMaterialsData[standardId].forEach(material => {
                        if (material.type) {
                            uniqueTypes.add(material.type);
                        }
                    });
                }
            }
            
            // Сортируем типы, чтобы они всегда были в одном порядке
            const sortedTypes = Array.from(uniqueTypes).sort();

            // Добавляем уникальные типы в селектор
            sortedTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                // Более понятное отображение (например, "steel" -> "Сталь")
                option.textContent = type === 'steel' ? 'Сталь' : (type === 'concrete' ? 'Бетон' : type); 
                materialTypeSelect.appendChild(option);
            });
        }


        // Функция для заполнения выпадающего списка "Стандарт"
        function populateStandardSelect() {
            const materialStandardSelect = document.getElementById('materialStandardSelect');
            if (materialStandardSelect) {
                materialStandardSelect.innerHTML = ''; // Очищаем текущие опции
                standardsData.forEach(standard => {
                    const option = document.createElement('option');
                    option.value = standard.id;
                    option.textContent = standard.id; // Или standard.name, если хотите более читаемое название
                    materialStandardSelect.appendChild(option);
                });
            }
        }

        // Функция для заполнения выпадающего списка "Класс/Марка"
        function populateMaterialClassSelect() {
            const materialTypeSelect = document.getElementById('materialTypeSelect');
            const materialStandardSelect = document.getElementById('materialStandardSelect');
            const materialClassSelect = document.getElementById('materialClassSelect');

            if (!materialTypeSelect || !materialStandardSelect || !materialClassSelect) {
                console.error("One or more material select elements not found. Cannot populate material class.");
                return;
            }

            const selectedType = materialTypeSelect.value; // 'steel' or 'concrete'
            const selectedStandard = materialStandardSelect.value; // 'GOST_SP', 'EN', etc.
            materialClassSelect.innerHTML = ''; // Очищаем текущие опции

            // Получаем данные для выбранного стандарта
            const materialsFromSelectedStandard = allMaterialsData[selectedStandard];

            if (materialsFromSelectedStandard && materialsFromSelectedStandard.length > 0) {
                // Фильтруем по типу материала
                const filteredMaterials = materialsFromSelectedStandard.filter(
                    mat => mat.type === selectedType // Теперь фильтруем по полю 'type' внутри объектов материала
                );

                if (filteredMaterials.length > 0) {
                    filteredMaterials.forEach(material => {
                        const option = document.createElement('option');
                        option.value = material.id;
                        option.textContent = material.name;
                        materialClassSelect.appendChild(option);
                    });
                } else {
                    const option = document.createElement('option');
                    option.value = "";
                    option.textContent = "No added materials in the model yet";
                    materialClassSelect.appendChild(option);
                }
            } else {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "No data for the selected standard";
                materialClassSelect.appendChild(option);
            }
        }

        // Инициализация при открытии модального окна или загрузке страницы
        async function initializeMaterialSelectors() {
            await loadAllMaterials(); // Сначала загружаем все данные
			
			if (Object.keys(allMaterialsData).length > 0 && standardsData.length > 0) {
				populateStandardSelect(); 
				populateMaterialTypeSelect();
				populateMaterialClassSelect();
				displaySelectedMaterialProperties(); // <-- НОВОЕ: Вызываем при инициализации
			} else {
				console.warn("No material data or standards data loaded. Material selectors will not be populated.");
				displaySelectedMaterialProperties(); // Все равно вызовите, чтобы очистить отображение
			}
        }

        // Функция для отображения материалов в модальном окне
        function renderMaterialsList() {
            if (!materialListContainer) return; // Защита от вызова до инициализации

            materialListContainer.innerHTML = ''; // Очищаем контейнер перед заполнением
            
            if (allMaterials.length === 0) {
                materialListContainer.innerHTML = '<p>Materials not found in data</p>';
                return;
            }

            // Создаем группы для бетона и стали для лучшей организации
            const concreteGroup = document.createElement('div');
            concreteGroup.className = 'mb-4 border-b pb-2'; 
            concreteGroup.innerHTML = '<h3 class="text-lg font-semibold text-gray-700 mb-2">Бетон</h3>';
            materialListContainer.appendChild(concreteGroup);

            const steelGroup = document.createElement('div');
            steelGroup.className = 'mb-4';
            steelGroup.innerHTML = '<h3 class="text-lg font-semibold text-gray-700 mb-2">Сталь</h3>';
            materialListContainer.appendChild(steelGroup);

            allMaterials.forEach(material => {
                const materialDiv = document.createElement('div');
                materialDiv.className = 'bg-gray-100 p-3 rounded-md flex justify-between items-center shadow-sm mb-2'; 
                materialDiv.innerHTML = `
                    <div>
                        <p class="font-medium text-gray-800">${material.name} (${material.type === 'concrete' ? 'Concrete' : 'Steel'})</p>
                        <p class="text-sm text-gray-600">Modulus of elasticity (E): ${material.properties.elasticModulus.value} ${material.properties.elasticModulus.unit}</p>
                        <p class="text-sm text-gray-600">Density: ${material.properties.density.value} ${material.properties.density.unit}</p>
                    </div>
                    <!-- Кнопка "Выбрать" пока ничего не делает, но HTML для нее есть -->
                    <button class="select-material-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors duration-200" data-material-id="${material.id}">Выбрать</button>
                `;
                
                if (material.type === 'concrete') {
                    concreteGroup.appendChild(materialDiv);
                } else if (material.type === 'steel') {
                    steelGroup.appendChild(materialDiv);
                }
            });
            // Мы пока не добавляем обработчик для кнопки "Выбрать" здесь. Это будет на следующем шаге.
        }		
		
		// Функция для добавления материала в модель
        function addSelectedMaterialToModel() {
            const selectedMaterialId = materialClassSelect.value;
            const selectedStandardId = materialStandardSelect.value;

            if (!selectedMaterialId || !selectedStandardId) {
                alert('Please select standard and material class/grade');
                return;
            }

            // Находим выбранный материал в allMaterialsData
            const materialsForStandard = allMaterialsData[selectedStandardId];
            const materialToAdd = materialsForStandard ? materialsForStandard.find(m => m.id === selectedMaterialId) : null;

            if (materialToAdd) {
                // Проверяем, не добавлен ли этот материал уже в модель
                if (modelMaterials.some(m => m.id === materialToAdd.id)) {
                    alert(`Material "${materialToAdd.name}" (${materialToAdd.standard}) has already added to the model`);
                    return;
                }

                modelMaterials.push(materialToAdd);
                console.log("Material added to model:", materialToAdd);
                // Обновляем список материалов в модальном окне
                renderModelMaterialsList();
            } else {
                console.error("Selected material not found:", selectedMaterialId, selectedStandardId);
                alert("The selected material could not be found. Please try again");
            }
        }
		
		// Функция для отрисовки списка материалов, добавленных в модель
        function renderModelMaterialsList() {
            const modelMaterialList = document.getElementById('modelMaterialList');
            if (!modelMaterialList) {
                console.error("Element #modelMaterialList not found.");
                return;
            }

            modelMaterialList.innerHTML = ''; // Очищаем список

            const noMaterialsMessage = document.getElementById('noMaterialsMessage');
            if (noMaterialsMessage) { // Удаляем сообщение "Нет материалов" если оно есть
                noMaterialsMessage.remove();
            }

            if (modelMaterials.length === 0) {
                // Если материалов нет, добавляем сообщение
                const message = document.createElement('li');
                message.id = 'noMaterialsMessage';
                message.classList.add('text-gray-500');
                message.textContent = 'No materials in the model';
                modelMaterialList.appendChild(message);
            } else {
                modelMaterials.forEach(material => {
                    const listItem = document.createElement('li');
                    listItem.id = `model-material-${material.id}`; // Уникальный ID для элемента списка
                    listItem.classList.add('flex', 'justify-between', 'items-center', 'p-2', 'border-b', 'last:border-b-0');
                    listItem.innerHTML = `
                        <span>${material.name} (${material.standard}) - ${material.type}</span>
                        <button class="remove-material-btn bg-red-500 hover:bg-red-700 text-white text-xs font-bold py-1 px-2 rounded" data-material-id="${material.id}">
                            Delete
                        </button>
                    `;
                    modelMaterialList.appendChild(listItem);
                });

                // Добавляем слушатели событий для кнопок удаления после их создания
                modelMaterialList.querySelectorAll('.remove-material-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const materialIdToRemove = event.target.dataset.materialId;
                        removeMaterialFromModel(materialIdToRemove);
                    });
                });
            }
        }
		
		// Функция для удаления материала из модели
        function removeMaterialFromModel(materialId) {
            const initialLength = modelMaterials.length;
            modelMaterials = modelMaterials.filter(m => m.id !== materialId);

            if (modelMaterials.length < initialLength) {
                console.log("Material removed from model:", materialId);
                renderModelMaterialsList(); // Перерисовываем список
            } else {
                console.warn("Attempted to remove non-existent material:", materialId);
            }
        }

        // Функция для добавления сечения в модель
        function addSelectedSectionToModel() {
            const selectedSectionId = sectionNameSelect.value;
            const selectedStandardId = sectionStandardSelect.value;

            if (!selectedSectionId || !selectedStandardId) {
                alert('Please select standard and section');
                return;
            }

            const sectionsForStandard = allSectionsData[selectedStandardId] || [];
            const sectionToAdd = sectionsForStandard.find(sec => sec.id === selectedSectionId);

            if (sectionToAdd) {
                if (modelSections.some(s => s.id === sectionToAdd.id)) {
                    alert(`Section "${sectionToAdd.name}" (${sectionToAdd.standard}) has already added to the model`);
                    return;
                }

                modelSections.push(sectionToAdd);
                console.log('Section added to model:', sectionToAdd);
                renderModelSectionsList();
            } else {
                console.error('Selected section not found:', selectedSectionId, selectedStandardId);
                alert('The selected section could not be found. Please try again');
            }
        }

        // Функция для отрисовки списка сечений модели
        function renderModelSectionsList() {
            const modelSectionList = document.getElementById('modelSectionList');
            if (!modelSectionList) {
                console.error('Element #modelSectionList not found.');
                return;
            }

            modelSectionList.innerHTML = '';

            const noSectionsMessage = document.getElementById('noSectionsMessage');
            if (noSectionsMessage) {
                noSectionsMessage.remove();
            }

            if (modelSections.length === 0) {
                const message = document.createElement('li');
                message.id = 'noSectionsMessage';
                message.classList.add('text-gray-500');
                message.textContent = 'No sections in the model yet';
                modelSectionList.appendChild(message);
            } else {
                modelSections.forEach(section => {
                    const listItem = document.createElement('li');
                    listItem.id = `model-section-${section.id}`;
                    listItem.classList.add('flex', 'justify-between', 'items-center', 'p-2', 'border-b', 'last:border-b-0');
                    listItem.innerHTML = `
                        <span>${section.name} (${section.standard}) - ${section.type}</span>
                        <button class="remove-section-btn bg-red-500 hover:bg-red-700 text-white text-xs font-bold py-1 px-2 rounded" data-section-id="${section.id}">
                            Delete
                        </button>`;
                    modelSectionList.appendChild(listItem);
                });

                modelSectionList.querySelectorAll('.remove-section-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const sectionIdToRemove = event.target.dataset.sectionId;
                        removeSectionFromModel(sectionIdToRemove);
                    });
                });
            }
        }

        // Функция для удаления сечения из модели
        function removeSectionFromModel(sectionId) {
            const initialLength = modelSections.length;
            modelSections = modelSections.filter(s => s.id !== sectionId);

            if (modelSections.length < initialLength) {
                console.log('Section removed from model:', sectionId);
                renderModelSectionsList();
            } else {
                console.warn('Attempted to remove non-existent section:', sectionId);
            }
        }

        // ====================================================================
        // Сечения: Функции загрузки и заполнения списков
        // ====================================================================

        async function loadAllSections() {
            try {
                if (standardsData.length === 0) {
                    const standardsResponse = await fetch('data/standards.json');
                    if (!standardsResponse.ok) {
                        throw new Error(`HTTP error! status: ${standardsResponse.status}`);
                    }
                    standardsData = await standardsResponse.json();
                }

                for (const standard of standardsData) {
                    const filePath = standard.sectionFile;
                    if (!filePath || filePath === 'localStorage') continue;

                    const response = await fetch(filePath);
                    if (!response.ok) {
                        console.warn(`Warning: Section file ${filePath} not found or could not be loaded. Skipping.`);
                        continue;
                    }
                    const data = await response.json();
                    allSectionsData[standard.id] = data;
                }
            } catch (error) {
                console.error('Error loading sections data:', error);
            }
        }

        function populateSectionTypeSelect() {
            if (!sectionTypeSelect) return;
            sectionTypeSelect.innerHTML = '';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Выберите тип';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            sectionTypeSelect.appendChild(defaultOption);

            const uniqueTypes = new Set();
            for (const standardId in allSectionsData) {
                allSectionsData[standardId].forEach(sec => {
                    if (sec.type) uniqueTypes.add(sec.type);
                });
            }

            Array.from(uniqueTypes).sort().forEach(type => {
                const opt = document.createElement('option');
                opt.value = type;
                opt.textContent = type;
                sectionTypeSelect.appendChild(opt);
            });

            if (uniqueTypes.has('I-beam')) {
                sectionTypeSelect.value = 'I-beam';
            }
        }

        function populateSectionStandardSelect() {
            if (!sectionStandardSelect) return;
            sectionStandardSelect.innerHTML = '';
            standardsData.forEach(std => {
                if (!std.sectionFile) return;
                const opt = document.createElement('option');
                opt.value = std.id;
                opt.textContent = std.id;
                sectionStandardSelect.appendChild(opt);
            });
        }

        function populateSectionNameSelect() {
            if (!sectionNameSelect) return;
            sectionNameSelect.innerHTML = '';

            const selectedStandard = sectionStandardSelect.value;
            const selectedType = sectionTypeSelect.value;
            const sections = allSectionsData[selectedStandard] || [];

            const filtered = sections.filter(sec => (!selectedType || sec.type === selectedType));

            filtered.forEach(sec => {
                const opt = document.createElement('option');
                opt.value = sec.id;
                opt.textContent = sec.name;
                sectionNameSelect.appendChild(opt);
            });
        }

        async function initializeSectionSelectors() {
            await loadAllSections();
            populateSectionStandardSelect();
            populateSectionTypeSelect();
            populateSectionNameSelect();
            updateSectionImage();
            displaySelectedSectionProperties();
        }

        function displaySelectedSectionProperties() {
            const selectedSectionId = sectionNameSelect.value;
            const selectedStandardId = sectionStandardSelect.value;
            let selectedSection = null;
            if (selectedSectionId && selectedStandardId) {
                const sectionsForStandard = allSectionsData[selectedStandardId] || [];
                selectedSection = sectionsForStandard.find(sec => sec.id === selectedSectionId);
            }

            const isUser = selectedStandardId === 'USER';
            sectionNameSelect.disabled = isUser;
            if (userSectionNameContainer) {
                if (isUser) {
                    userSectionNameContainer.classList.remove('hidden');
                } else {
                    userSectionNameContainer.classList.add('hidden');
                }
            }
            if (selectedSection && selectedSection.properties) {
                const props = selectedSection.properties;
                sectionHeightSpan.value = props.height ? props.height.value : '';
                sectionWidthSpan.value = props.width ? props.width.value : '';
                sectionWebThicknessSpan.value = props.webThickness ? props.webThickness.value : '';
                sectionFlangeThicknessSpan.value = props.flangeThickness ? props.flangeThickness.value : '';
            } else {
                sectionHeightSpan.value = '';
                sectionWidthSpan.value = '';
                sectionWebThicknessSpan.value = '';
                sectionFlangeThicknessSpan.value = '';
            }

            sectionHeightSpan.disabled = !isUser;
            sectionWidthSpan.disabled = !isUser;
            sectionWebThicknessSpan.disabled = !isUser;
            sectionFlangeThicknessSpan.disabled = !isUser;
        }

        function displaySectionCharacteristics() {
            const selectedSectionId = sectionNameSelect.value;
            const selectedStandardId = sectionStandardSelect.value;
            let selectedSection = null;
            if (selectedSectionId && selectedStandardId) {
                const sectionsForStandard = allSectionsData[selectedStandardId] || [];
                selectedSection = sectionsForStandard.find(sec => sec.id === selectedSectionId);
            }

            sectionDetailsContent.innerHTML = '';
            if (selectedSection && selectedSection.properties) {
                for (const key in selectedSection.properties) {
                    if (['height','width','webThickness','flangeThickness','radius'].includes(key)) continue;
                    const prop = selectedSection.properties[key];
                    const p = document.createElement('p');
                    p.textContent = `${key}: ${prop.value} ${getUnitText(prop.unit)}`;
                    sectionDetailsContent.appendChild(p);
                }
            }
        }

        function updateSectionImage() {
            if (!sectionImage) return;
            const type = sectionTypeSelect.value;
            let src = '';
            if (type === 'I-beam') {
                src = 'images/sec_I-beam.svg';
            } else if (type === 'C-channel') {
                src = 'images/sec_C-channel.svg';
            }
            sectionImage.src = src;
        }
		

        function applyRestrictionToSelectedNode(dxValue, dyValue, drValue) {
            if (!selectedNode) return;

            let existingRestrictionIndex = restrictions.findIndex(res => res.node_id === selectedNode.node_id);

            const newRestriction = {
                node_id: selectedNode.node_id,
                dx: dxValue,
                dy: dyValue,
                dr: drValue
            };

            if (dxValue === 0 && dyValue === 0 && drValue === 0) {
                if (existingRestrictionIndex !== -1) {
                    restrictions.splice(existingRestrictionIndex, 1);
                }
            } else {
                if (existingRestrictionIndex !== -1) {
                    restrictions[existingRestrictionIndex] = newRestriction;
                } else {
                    restrictions.push(newRestriction);
                }
            }
            draw();
            updatePropertiesPanel(); 
        }

        function updateCursorTooltip() {
            if (hoveredElement && !isPanning && customContextMenu.classList.contains('hidden')) {
                cursorTooltip.classList.add('hidden');
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const offsetX = 15;
            const offsetY = 15;
            const worldX = snapToGrid ? mouse.snappedX : mouse.worldX;
            const worldY = snapToGrid ? mouse.snappedY : mouse.worldY;
            cursorTooltip.innerHTML = `X: ${worldX.toFixed(2)} ${currentUnit}<br>Y: ${worldY.toFixed(2)} ${currentUnit}`;
            cursorTooltip.style.left = `${rect.left + mouse.x + offsetX}px`;
            cursorTooltip.style.top = `${rect.top + mouse.y + offsetY}px`;
            cursorTooltip.classList.remove('hidden');
        }

        // Tooltip
        function updateTooltip() {
            const panelWidth = propertiesPanel.offsetWidth;

            if (hoveredElement && !isPanning && customContextMenu.classList.contains('hidden')) { 
                let content = '';
                if (hoveredElement.type === 'node') {
                    const node = hoveredElement.element;
                    const restriction = restrictions.find(res => res.node_id === node.node_id);
                    let restrictionInfo = '';
                    if (restriction) {
                        const typeKey = Object.keys(restrictionTypes).find(key => 
                            restrictionTypes[key].dx === restriction.dx &&
                            restrictionTypes[key].dy === restriction.dy &&
                            restrictionTypes[key].dr === restriction.dr
                        );
                        if (typeKey && restrictionTypes[typeKey].label) {
                            restrictionInfo = `\nBoundaries: ${restrictionTypes[typeKey].label}`;
                        } else {
                             restrictionInfo = `\nBoundaries: dx=${restriction.dx}, dy=${restriction.dy}, dr=${restriction.dr}`;
                        }
                    }

                    content = `Node ${node.node_id}\nX: ${node.x.toFixed(3)} ${currentUnit}\nY: ${node.y.toFixed(3)} ${currentUnit}${restrictionInfo}`; 
                } else if (hoveredElement.type === 'line') {
                    const line = hoveredElement.element;
                    const n1 = nodes.find(n => n.node_id === line.nodeId1); 
                    const n2 = nodes.find(n => n.node_id === line.nodeId2); 
                    if (n1 && n2) { 
                        const dx = n2.x - n1.x; 
                        const dy = n2.y - n1.y; 
                        const length = Math.sqrt(dx**2 + dy**2); 
                        content = `Rod ${line.elem_id}\Length: ${length.toFixed(3)} ${currentUnit}`; 
                    }
                }
                
                if (content) {
                    tooltip.innerHTML = content;
                    tooltip.classList.remove('hidden'); 
                    tooltip.style.left = `0px`; 
                    tooltip.style.top = `0px`; 
                    const tooltipRect = tooltip.getBoundingClientRect(); 
                    
                    const offsetX = 15; 
                    const offsetY = 15; 

                    let finalLeft = mouse.x + canvas.getBoundingClientRect().left + offsetX;
                    let finalTop = mouse.y + canvas.getBoundingClientRect().top + offsetY;

                    if (finalLeft + tooltipRect.width > window.innerWidth) {
                        finalLeft = mouse.x + canvas.getBoundingClientRect().left - offsetX - tooltipRect.width; 
                    }

                    if (finalTop + tooltipRect.height > window.innerHeight) {
                        finalTop = mouse.y + canvas.getBoundingClientRect().top - offsetY - tooltipRect.height;
                    }
                    
                    const panelWidth = propertiesPanel.offsetWidth;
                    if (finalLeft < panelWidth) {
                         if (mouse.x + canvas.getBoundingClientRect().left < panelWidth + tooltipRect.width + offsetX) { 
                             finalLeft = panelWidth + offsetX;
                         } else {
                             finalLeft = mouse.x + canvas.getBoundingClientRect().left - offsetX - tooltipRect.width;
                         }
                    }

                    tooltip.style.left = `${finalLeft}px`; 
                    tooltip.style.top = `${finalTop}px`;
                } else {
                    tooltip.classList.add('hidden');
                }
            } else {
                tooltip.classList.add('hidden');
            }
        }
		
		
        // Функция для показа/скрытия секции пользовательского материала
        function toggleCustomMaterialFields(show) {
            const customMaterialBlock = document.getElementById('customMaterialBlock');
            if (customMaterialBlock) {
                if (show) {
                    customMaterialBlock.classList.remove('hidden');
                } else {
                    customMaterialBlock.classList.add('hidden');
                }
            } else {
                console.warn("Custom material block not found.");
            }
        }

        function drawResults() {
            if (!resultsData || !activeDiagram) return;

            const resultsForceUnit = resultsData.units?.force || 'kN';
            const resultsLengthUnit = resultsData.units?.length || 'm';
            const currentLengthUnit = unitsSelect.value;
            const canvasBgColor = getComputedStyle(canvas).backgroundColor;

            function drawLabel(text, x, y, color) {
                ctx.save();
                ctx.scale(1, -1);
                ctx.font = `${12 / scale}px Roboto`;
                ctx.textBaseline = 'bottom';
                const offset = 6 / scale;
                const drawX = x + offset;
                const drawY = -y - offset;
                const padding = 2 / scale;
                const textWidth = ctx.measureText(text).width;
                const textHeight = 12 / scale;
                ctx.fillStyle = canvasBgColor;
                ctx.fillRect(drawX - padding, drawY - textHeight - padding,
                    textWidth + 2 * padding, textHeight + 2 * padding);
                ctx.fillStyle = color;
                ctx.fillText(text, drawX, drawY);
                ctx.restore();
            }

            let globalMax = 0;
            if (activeDiagram === 'Uxy') {
                resultsData.rods.forEach(rod => {
                    const ux = rod.results.Ux_diagram || [];
                    const uz = rod.results.Uz_diagram || [];
                    const count = Math.min(ux.length, uz.length);
                    for (let i = 0; i < count; i++) {
                        const mag = Math.sqrt(ux[i].value * ux[i].value + uz[i].value * uz[i].value);
                        if (mag > globalMax) globalMax = mag;
                    }
                });
            } else {
                const key = activeDiagram === 'My' ? 'My_diagram' : 'Qz_diagram';
                resultsData.rods.forEach(rod => {
                    const diag = rod.results[key] || [];
                    diag.forEach(pt => {
                        const val = Math.abs(pt.value);
                        if (val > globalMax) globalMax = val;
                    });
                });
            }

            if (globalMax === 0) globalMax = 1;
            const avgLen =
                resultsData.rods.reduce((s, r) => s + convertUnits(r.length, resultsLengthUnit, currentLengthUnit), 0) /
                resultsData.rods.length;
            const baseScale = (avgLen * 0.2) / globalMax;

            resultsData.rods.forEach(rod => {
                const line = lines.find(l => l.elem_id === rod.elem_id);
                if (!line) return;
                const n1 = nodes.find(n => n.node_id === line.nodeId1);
                const n2 = nodes.find(n => n.node_id === line.nodeId2);
                if (!n1 || !n2) return;
                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const L = Math.hypot(dx, dy);
                const ex = dx / L;
                const ey = dy / L;
                const px = -ey;
                const py = ex;

                if (activeDiagram === 'Uxy') {
                    const ux = rod.results.Ux_diagram || [];
                    const uz = rod.results.Uz_diagram || [];
                    const count = Math.min(ux.length, uz.length);
                    if (count === 0) return;

                    const pts = [];
                    for (let i = 0; i < count; i++) {
                        const pos = convertUnits(ux[i].position, resultsLengthUnit, currentLengthUnit);
                        const baseX = n1.x + ex * pos;
                        const baseY = n1.y + ey * pos;
                        const x = baseX + ux[i].value * baseScale;
                        const y = baseY + uz[i].value * baseScale;
                        const mag = Math.sqrt(ux[i].value * ux[i].value + uz[i].value * uz[i].value);
                        pts.push({ x, y, baseX, baseY, mag });
                    }

                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 0; i < pts.length - 1; i++) {
                        const xc = (pts[i].x + pts[i + 1].x) / 2;
                        const yc = (pts[i].y + pts[i + 1].y) / 2;
                        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
                    }
                    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                    ctx.strokeStyle = 'blue';
                    ctx.lineWidth = 1 / scale;
                    ctx.stroke();

                    let maxP = pts[0];
                    pts.forEach(p => { if (p.mag > maxP.mag) maxP = p; });
                    const maxDisp = convertUnits(maxP.mag, resultsLengthUnit, currentLengthUnit);
                    drawLabel(maxDisp.toFixed(3), maxP.x, maxP.y, 'blue');
                } else {
                    const key = activeDiagram === 'My' ? 'My_diagram' : 'Qz_diagram';
                    const diag = rod.results[key] || [];
                    if (diag.length === 0) return;
                    const pts = [];
                    diag.forEach(pt => {
                        let val = pt.value;
                        if (activeDiagram === 'My') val = -val;
                        const pos = convertUnits(pt.position, resultsLengthUnit, currentLengthUnit);
                        const baseX = n1.x + ex * pos;
                        const baseY = n1.y + ey * pos;
                        const x = baseX + px * val * baseScale;
                        const y = baseY + py * val * baseScale;

                        ctx.beginPath();
                        ctx.moveTo(baseX, baseY);
                        ctx.lineTo(x, y);
                        ctx.strokeStyle = activeDiagram === 'My' ? 'red' : 'green';
                        ctx.lineWidth = 0.5 / scale;
                        ctx.stroke();

                        pts.push({ x, y, baseX, baseY, raw: pt.value });
                    });

                    ctx.beginPath();
                    ctx.moveTo(n1.x, n1.y);
                    ctx.lineTo(pts[0].x, pts[0].y);
                    for (let i = 0; i < pts.length - 1; i++) {
                        const xc = (pts[i].x + pts[i + 1].x) / 2;
                        const yc = (pts[i].y + pts[i + 1].y) / 2;
                        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
                    }
                    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                    ctx.lineTo(n2.x, n2.y);
                    ctx.strokeStyle = activeDiagram === 'My' ? 'red' : 'green';
                    ctx.lineWidth = 1 / scale;
                    ctx.stroke();

                    let maxVal = 0;
                    let maxPoint = pts[0];
                    diag.forEach((pt, i) => {
                        const val = Math.abs(pt.value);
                        if (val > maxVal) {
                            maxVal = val;
                            maxPoint = pts[i];
                        }
                    });

                    const currentForceUnit = forceUnitsSelect.value;
                    const maxValConverted = activeDiagram === 'My'
                        ? convertMoment(maxVal, resultsForceUnit, resultsLengthUnit, currentForceUnit, currentLengthUnit)
                        : convertForce(maxVal, resultsForceUnit, currentForceUnit);
                    const startValConverted = activeDiagram === 'My'
                        ? convertMoment(diag[0].value, resultsForceUnit, resultsLengthUnit, currentForceUnit, currentLengthUnit)
                        : convertForce(diag[0].value, resultsForceUnit, currentForceUnit);
                    const endValConverted = activeDiagram === 'My'
                        ? convertMoment(diag[diag.length - 1].value, resultsForceUnit, resultsLengthUnit, currentForceUnit, currentLengthUnit)
                        : convertForce(diag[diag.length - 1].value, resultsForceUnit, currentForceUnit);

                    const color = activeDiagram === 'My' ? 'red' : 'green';
                    drawLabel(maxValConverted.toFixed(3), maxPoint.x, maxPoint.y, color);
                    drawLabel(startValConverted.toFixed(3), pts[0].x, pts[0].y, color);
                    drawLabel(endValConverted.toFixed(3), pts[pts.length - 1].x, pts[pts.length - 1].y, color);
                }
            });
        }

        // Функция для добавления нового пользовательского материала
        function addCustomMaterial(name, type, elasticModulus, density, poissonRatio) {
            if (!name || isNaN(elasticModulus) || isNaN(density) || isNaN(poissonRatio)) {
                alert("Please fill in all fields for the custom material (Name, Elastic Modulus, Density, Poisson's Ratio)");
                return;
            }

            const newMaterial = {
                id: `user_material_${Date.now()}`, // Уникальный ID на основе метки времени
                name: name,
                type: type, // Тип материала (steel, concrete)
                standard: "USER", 
                properties: {
                    elasticModulus: { value: elasticModulus, unit: "MPa" }, // Убедитесь, что unit соответствует вашим ожиданиям
                    density: { value: density, unit: "kg/m^3" },
                    poissonRatio: { value: poissonRatio, unit: "none" },
                }
            };

            userMaterials.push(newMaterial); // Добавляем в глобальный массив пользовательских материалов
            allMaterialsData['USER'] = userMaterials; // Обновляем данные для USER стандарта в общем объекте
            saveUserMaterialsToLocalStorage(userMaterials); // Сохраняем в localStorage

            populateMaterialClassSelect(); // Обновляем выпадающий список "Класс/Марка"

            // Можно выбрать только что добавленный материал в списке
            // if (materialClassSelect) {
            //     materialClassSelect.value = newMaterial.id;
            // }
            alert(`Material "${name}" successfully added`);
        }
		
		// Функция для отображения свойств выбранного материала
        function displaySelectedMaterialProperties() {
            const selectedMaterialId = materialClassSelect.value;
            const selectedStandardId = materialStandardSelect.value;

            let selectedMaterial = null;

            // Если оба селектора имеют выбранное значение
            if (selectedMaterialId && selectedStandardId) {
                const materialsForStandard = allMaterialsData[selectedStandardId];
                if (materialsForStandard) {
                    selectedMaterial = materialsForStandard.find(m => m.id === selectedMaterialId);
                }
            }

            // Обновляем UI с свойствами материала
            if (selectedMaterial) {
                propName.textContent = selectedMaterial.name || 'N/A';
                propType.textContent = (selectedMaterial.type === 'steel' ? 'Steel' : selectedMaterial.type === 'concrete' ? 'Concrete' : selectedMaterial.type || 'N/A');
                
                const standardDisplayName = standardsData.find(s => s.id === selectedMaterial.standard)?.name || selectedMaterial.standard || 'N/A';
                propStandard.textContent = standardDisplayName;
                
                // Модуль упругости
                propElasticModulus.textContent = selectedMaterial.properties && selectedMaterial.properties.elasticModulus ? selectedMaterial.properties.elasticModulus.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A';
                unitElasticModulus.textContent = selectedMaterial.properties && selectedMaterial.properties.elasticModulus ? getUnitText(selectedMaterial.properties.elasticModulus.unit) : ''; // ИСПОЛЬЗУЕМ getUnitText()

                // Плотность
                propDensity.textContent = selectedMaterial.properties && selectedMaterial.properties.density ? selectedMaterial.properties.density.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A';
                unitDensity.textContent = selectedMaterial.properties && selectedMaterial.properties.density ? getUnitText(selectedMaterial.properties.density.unit) : ''; // ИСПОЛЬЗУЕМ getUnitText()

                // Коэффициент Пуассона
                propPoissonRatio.textContent = selectedMaterial.properties && selectedMaterial.properties.poissonRatio ? selectedMaterial.properties.poissonRatio.value.toFixed(3) : 'N/A';
                unitPoissonRatio.textContent = selectedMaterial.properties && selectedMaterial.properties.poissonRatio ? getUnitText(selectedMaterial.properties.poissonRatio.unit) : ''; // ИСПОЛЬЗУЕМ getUnitText()

                // Пример для коэффициента демпфирования (если он будет):
                // propDampingCoefficient.textContent = selectedMaterial.properties && selectedMaterial.properties.dampingCoefficient ? selectedMaterial.properties.dampingCoefficient.value.toFixed(3) : 'N/A';
                // unitDampingCoefficient.textContent = selectedMaterial.properties && selectedMaterial.properties.dampingCoefficient ? getUnitText(selectedMaterial.properties.dampingCoefficient.unit) : '';
            } else {
                // Если материал не выбран или не найден, очищаем поля
                propName.textContent = 'Not selected';
                propType.textContent = '';
                propStandard.textContent = '';
                propElasticModulus.textContent = '';
                unitElasticModulus.textContent = '';
                propDensity.textContent = '';
                unitDensity.textContent = '';
                propPoissonRatio.textContent = '';
                unitPoissonRatio.textContent = '';
            }
        }
		
		
let materialTypeSelect;
let materialStandardSelect;
let materialClassSelect;
let sectionTypeSelect;
let sectionStandardSelect;
let sectionNameSelect;
let sectionHeightSpan;
let sectionWidthSpan;
let sectionWebThicknessSpan;
let sectionFlangeThicknessSpan;
let sectionImage;
let userSectionNameContainer;
let userSectionNameInput;
let sectionDetailsContent;
let materialsModal;
let sectionsModal;
		
		document.addEventListener('DOMContentLoaded', async () => {
            console.log('DOMContentLoaded fired. Starting initialization...'); 
            // --- 1. Получаем ссылки на ВСЕ DOM-элементы здесь, когда они гарантированно существуют ---
            // ... (все ваши существующие document.getElementById(...) для propertiesPanel, canvas, и т.д.) ...

            // --- ДОБАВЬТЕ ЭТУ СТРОКУ, ЕСЛИ ЕЕ НЕТ ---
            // Если materialListContainer нужен глобально, объявите его с 'let' в глобальной области видимости
            // Если он нужен только здесь, то:
            const materialListContainer = document.getElementById('materialListContainer'); 
            console.log('materialListContainer:', materialListContainer); // DEBUG: Проверить, что элемент найден
			
            // Объявляем переменные для кнопок и модального окна ОДИН РАЗ с 'const'
            const openMaterialsModalBtn = document.getElementById('openMaterialsModalBtn'); // Кнопка в topBar
            const openMaterialsModalBtnFromPanel = document.getElementById('openMaterialsModalBtnFromPanel'); // Кнопка в propertiesPanel
            
            materialsModal = document.getElementById('materialsModal');
            const closeMaterialsModalBtn = document.getElementById('closeMaterialsModalBtn');
            const closeMaterialsModalBtnBottom = document.getElementById('closeMaterialsModalBtnBottom');

            const openSectionsModalBtn = document.getElementById('openSectionsModalBtn');
            sectionsModal = document.getElementById('sectionsModal');
            const closeSectionsModalBtn = document.getElementById('closeSectionsModalBtn');
            const showSectionPropsBtn = document.getElementById('showSectionPropsBtn');
            const sectionDetailsModal = document.getElementById('sectionDetailsModal');
            const closeSectionDetailsBtn = document.getElementById('closeSectionDetailsBtn');
            sectionDetailsContent = document.getElementById('sectionDetailsContent');

            const toggleNodeNumbersBtn = document.getElementById("toggleNodeNumbersBtn");
            const toggleLineNumbersBtn = document.getElementById("toggleLineNumbersBtn");
            const toggleBetaAngleIconsBtn = document.getElementById("toggleBetaAngleIconsBtn");

            const materialsMenuItem = document.getElementById('materialsMenuItem');
            const sectionsMenuItem = document.getElementById('sectionsMenuItem');
            const selectAllMenu = document.getElementById('selectAllMenu');
            const clearAllMenu = document.getElementById('clearAllMenu');
            const visibilityNodesMenuItem = document.getElementById('visibilityNodesMenuItem');
            const visibilityElementsMenuItem = document.getElementById('visibilityElementsMenuItem');
            const visibilitySectionsMenuItem = document.getElementById('visibilitySectionsMenuItem');
            const visibilityLoadsMenuItem = document.getElementById('visibilityLoadsMenuItem');
            const clearAllModal = document.getElementById('clearAllModal');
            const confirmClearAll = document.getElementById('confirmClearAll');
            const cancelClearAll = document.getElementById('cancelClearAll');
            const closeClearAllModal = document.getElementById('closeClearAllModal');
			
			// Получаем ссылки на новые DOM-элементы
            const addMaterialToModelBtn = document.getElementById('addMaterialToModelBtn');
            const modelMaterialList = document.getElementById('modelMaterialList'); // Получите ссылку здесь, если она не глобальная
            const addSectionToModelBtn = document.getElementById('addSectionToModelBtn');
            const modelSectionList = document.getElementById('modelSectionList');
			
            // Получаем ссылки на элементы селекторов материалов
            materialTypeSelect = document.getElementById('materialTypeSelect');
            materialStandardSelect = document.getElementById('materialStandardSelect');
            materialClassSelect = document.getElementById('materialClassSelect');
            sectionTypeSelect = document.getElementById('sectionTypeSelect');
            sectionStandardSelect = document.getElementById('sectionStandardSelect');
            sectionNameSelect = document.getElementById('sectionNameSelect');
            sectionHeightSpan = document.getElementById('height');
            sectionWidthSpan = document.getElementById('width');
            sectionWebThicknessSpan = document.getElementById('webThickness');
            sectionFlangeThicknessSpan = document.getElementById('flangeThickness');
            sectionImage = document.getElementById('sectionImage');
            userSectionNameContainer = document.getElementById('userSectionNameContainer');
            userSectionNameInput = document.getElementById('userSectionNameInput');
			
			// НОВЫЕ: Получаем ссылки на элементы для пользовательского материала
            const customMaterialFields = document.getElementById('customMaterialFields');
            const customMaterialName = document.getElementById('customMaterialName');
            const customElasticModulus = document.getElementById('customElasticModulus');
            const customDensity = document.getElementById('customDensity');
            const customPoissonRatio = document.getElementById('customPoissonRatio');
			const saveCustomMaterialBtn = document.getElementById('saveCustomMaterialBtn'); // Кнопка "Сохранить"
			
			// НОВЫЕ: Получаем ссылки на элементы для отображения свойств материала
            // Обратите внимание: для propName, propType, propStandard мы берем span внутри p
            const propName = document.getElementById('propName');
            const propType = document.getElementById('propType');
            const propStandard = document.getElementById('propStandard');
            const propElasticModulus = document.getElementById('propElasticModulus');
            const unitElasticModulus = document.getElementById('unitElasticModulus');
            const propDensity = document.getElementById('propDensity');
            const unitDensity = document.getElementById('unitDensity');
            const propPoissonRatio = document.getElementById('propPoissonRatio');
            const unitPoissonRatio = document.getElementById('unitPoissonRatio');
            if (toggleNodeNumbersBtn) {
                toggleNodeNumbersBtn.addEventListener("click", () => {
                    showNodeIds = !showNodeIds;
                    toggleNodeNumbersBtn.classList.toggle("active", showNodeIds);
                    draw();
                });
            }
            if (toggleLineNumbersBtn) {
                toggleLineNumbersBtn.addEventListener("click", () => {
                    showElementIds = !showElementIds;
                    toggleLineNumbersBtn.classList.toggle("active", showElementIds);
                    draw();
                });
            }
            if (toggleBetaAngleIconsBtn) {
                toggleBetaAngleIconsBtn.addEventListener("click", () => {
                    showBetaAngleIcons = !showBetaAngleIcons;
                    toggleBetaAngleIconsBtn.classList.toggle("active", showBetaAngleIcons);
                    draw();
                });
            }
            if (materialsMenuItem) {
                materialsMenuItem.addEventListener('click', toggleMaterialsModal);
            }
            if (sectionsMenuItem) {
                sectionsMenuItem.addEventListener('click', toggleSectionsModal);
            }
            if (selectAllMenu) {
                selectAllMenu.addEventListener('click', selectAllElements);
            }
            if (clearAllMenu && clearAllModal) {
                clearAllMenu.addEventListener('click', () => {
                    clearAllModal.classList.remove('hidden');
                });
            }
            if (clearCanvasBtn && clearAllModal) {
                clearCanvasBtn.addEventListener('click', () => {
                    clearAllModal.classList.remove('hidden');
                });
            }
            if (cancelClearAll && clearAllModal) {
                cancelClearAll.addEventListener('click', () => {
                    clearAllModal.classList.add('hidden');
                });
            }
            if (confirmClearAll && clearAllModal) {
                confirmClearAll.addEventListener('click', () => {
                    clearAll();
                    clearAllModal.classList.add('hidden');
                });
            }
            if (closeClearAllModal && clearAllModal) {
                closeClearAllModal.addEventListener('click', () => {
                    clearAllModal.classList.add('hidden');
                });
            }
            if (clearAllModal) {
                clearAllModal.addEventListener('click', (e) => {
                    if (e.target === clearAllModal) {
                        clearAllModal.classList.add('hidden');
                    }
                });
            }
            if (visibilityNodesMenuItem) {
                visibilityNodesMenuItem.addEventListener('click', () => {
                    showNodeIds = !showNodeIds;
                    if (toggleNodeNumbersBtn) {
                        toggleNodeNumbersBtn.classList.toggle('active', showNodeIds);
                    }
                    draw();
                });
            }
            if (visibilityElementsMenuItem) {
                visibilityElementsMenuItem.addEventListener('click', () => {
                    showElementIds = !showElementIds;
                    if (toggleLineNumbersBtn) {
                        toggleLineNumbersBtn.classList.toggle('active', showElementIds);
                    }
                    draw();
                });
            }
            if (visibilitySectionsMenuItem) {
                visibilitySectionsMenuItem.addEventListener('click', () => {
                    showBetaAngleIcons = !showBetaAngleIcons;
                    if (toggleBetaAngleIconsBtn) {
                        toggleBetaAngleIconsBtn.classList.toggle('active', showBetaAngleIcons);
                    }
                    draw();
                });
            }

            if (visibilityLoadsMenuItem) {
                visibilityLoadsMenuItem.addEventListener('click', () => {
                    showLoads = !showLoads;
                    draw();
                });
            }
            
            // Вам потребуется кнопка для сохранения нового материала. 
            // Предположим, у вас есть <button id="saveCustomMaterialBtn">Сохранить</button> в HTML
            //const saveCustomMaterialBtn = document.getElementById('saveCustomMaterialBtn');

            // ... (ваши существующие addEventListener для канваса, кнопок режимов, и т.д.) ...
			
            // Устанавливаем слушатели для модального окна материалов
            if (openMaterialsModalBtn) {
                openMaterialsModalBtn.addEventListener('click', toggleMaterialsModal);
            }
            if (openMaterialsModalBtnFromPanel) {
                openMaterialsModalBtnFromPanel.addEventListener('click', toggleMaterialsModal);
            }
            if (materialsModal) { // Добавьте проверку на существование модального окна
                if (closeMaterialsModalBtn) {
                    closeMaterialsModalBtn.addEventListener('click', toggleMaterialsModal);
                }
                if (closeMaterialsModalBtnBottom) {
                    closeMaterialsModalBtnBottom.addEventListener('click', toggleMaterialsModal);
                }
                materialsModal.addEventListener('click', (e) => {
                    if (e.target === materialsModal) { // Закрытие по клику вне модального окна
                        toggleMaterialsModal();
                    }
                });
            }

            function toggleSectionsModal() {
                sectionsModal.classList.toggle('hidden');
            }

            if (openSectionsModalBtn) {
                openSectionsModalBtn.addEventListener('click', toggleSectionsModal);
            }
            if (closeSectionsModalBtn) {
                closeSectionsModalBtn.addEventListener('click', toggleSectionsModal);
            }
            if (sectionsModal) {
                sectionsModal.addEventListener('click', (e) => {
                    if (e.target === sectionsModal) {
                        toggleSectionsModal();
                    }
                });
            }

            function toggleSectionDetailsModal() {
                sectionDetailsModal.classList.toggle('hidden');
            }

            if (showSectionPropsBtn) {
                showSectionPropsBtn.addEventListener('click', () => {
                    displaySectionCharacteristics();
                    toggleSectionDetailsModal();
                });
            }

            if (closeSectionDetailsBtn) {
                closeSectionDetailsBtn.addEventListener('click', toggleSectionDetailsModal);
            }

            if (sectionDetailsModal) {
                sectionDetailsModal.addEventListener('click', (e) => {
                    if (e.target === sectionDetailsModal) {
                        toggleSectionDetailsModal();
                    }
                });
            }
			
            // Получаем ссылки на селекторы материалов и добавляем слушатели
			//const materialTypeSelect = document.getElementById('materialTypeSelect');
			//const materialStandardSelect = document.getElementById('materialStandardSelect');

			if (materialTypeSelect) {
				materialTypeSelect.addEventListener('change', () => {
					populateMaterialClassSelect(); // Сначала обновляем список класса/марки
					displaySelectedMaterialProperties(); // <-- НОВОЕ: Затем обновляем свойства
				});
			}
                        if (materialStandardSelect) {
                                materialStandardSelect.addEventListener('change', () => {
                                        populateMaterialClassSelect(); // Сначала обновляем список класса/марки
                                        toggleCustomMaterialFields(materialStandardSelect.value === 'USER'); // Показать/скрыть секцию пользовательского материала
                                        displaySelectedMaterialProperties(); // <-- НОВОЕ: Затем обновляем свойства
                                });
                                toggleCustomMaterialFields(materialStandardSelect.value === 'USER');
                        }
			
            if (materialClassSelect) {
                materialClassSelect.addEventListener('change', displaySelectedMaterialProperties); // <-- Это строка, которая должна вызывать функцию
            }

            if (sectionTypeSelect) {
                sectionTypeSelect.addEventListener('change', () => {
                    populateSectionNameSelect();
                    updateSectionImage();
                    displaySelectedSectionProperties();
                });
            }
            if (sectionStandardSelect) {
                sectionStandardSelect.addEventListener('change', () => {
                    populateSectionNameSelect();
                    displaySelectedSectionProperties();
                });
            }
            if (sectionNameSelect) {
                sectionNameSelect.addEventListener('change', displaySelectedSectionProperties);
            }
			
			
			// НОВОЕ: Слушатель для кнопки сохранения пользовательского материала
            if (saveCustomMaterialBtn) {
                saveCustomMaterialBtn.addEventListener('click', () => {
                    // Вызываем функцию для добавления пользовательского материала
                    addCustomMaterial(
                        customMaterialName.value,
                        materialTypeSelect.value, // Берем тип из общего селектора типа материала
                        parseFloat(customElasticModulus.value),
                        parseFloat(customDensity.value),
                        parseFloat(customPoissonRatio.value)
                    );
                    // Очищаем поля формы после сохранения
                    customMaterialName.value = '';
                    customElasticModulus.value = '';
                    customDensity.value = '';
                    customPoissonRatio.value = '';
                });
            }
			
			// НОВОЕ: Слушатель для кнопки "Добавить в модель"
            if (addMaterialToModelBtn) {
                addMaterialToModelBtn.addEventListener('click', addSelectedMaterialToModel);
            }
            if (addSectionToModelBtn) {
                addSectionToModelBtn.addEventListener('click', addSelectedSectionToModel);
            }
            
                        // --- Инициализируем селекторы материалов и загружаем данные ---\
            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');

            // --- 3. Запускаем основную инициализацию приложения ---\
            init();

            Promise.all([
                initializeMaterialSelectors(),
                initializeSectionSelectors()
            ])
                .catch(error => console.error('Error initializing selectors:', error))
                .finally(() => {
                    if (loadingIndicator) loadingIndicator.classList.add('hidden');
                });

            console.log('Initialization complete.');
        });
		
		
		

        // Start the application
        //init();







