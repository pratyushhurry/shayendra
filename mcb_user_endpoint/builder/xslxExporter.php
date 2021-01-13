<?php
    require '../vendor/autoload.php';

    use PhpOffice\PhpSpreadsheet\Spreadsheet;
    use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
    use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
    use PhpOffice\PhpSpreadsheet\Settings;
    use PhpOffice\PhpSpreadsheet\Calculation\Calculation;
    use PhpOffice\PhpSpreadsheet\Style\Alignment;
    use PhpOffice\PhpSpreadsheet\IOFactory;
    use PhpOffice\PhpSpreadsheet\Style\Conditional;
    use PhpOffice\PhpSpreadsheet\Style\Color;
    use PhpOffice\PhpSpreadsheet\Style\Fill;
    use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
    use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
    use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
    use PhpOffice\PhpSpreadsheet\Worksheet\HeaderFooterDrawing;
    use PhpOffice\PhpSpreadsheet\Worksheet\HeaderFooter;
    use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

    $spreadsheet = IOFactory::Load("boiler_template.xltx");
    $spreadsheet->setActiveSheetIndexByName("template_x");
    $template = $spreadsheet->getActiveSheet();
    $template_definition = json_decode($template->getCell('A1')->getValue(), true);

    $spreadsheet->addSheet(new Worksheet($spreadsheet, "fake X"));
    $spreadsheet->setActiveSheetIndexByName("fake X");
    $worksheet = $spreadsheet->getActiveSheet();

    $mask = $_REQUEST['json_fake_dataset'];
    $dataset = json_decode($mask, true);

    //add the header from the template to the rendered worksheet
    //Using bottom left-most cell name from the cloneCells return value, the new cell offset is evaluated
    $boundary = cloneCells($template, $worksheet, $template_definition["header"]["range"], $template_definition["cell_offset"]);
    $next_cell_offset = Coordinate::stringfromColumnIndex($boundary["col"]).(++$boundary["row"] + $template_definition["skip_rows"]);

    $body_leftmost_cell = null;
    foreach($dataset as $data){
        $boundary = cloneCells($template, $worksheet, $template_definition["body"]["range"], $next_cell_offset, $data);
        //Using bottom left-most cell name from the cloneCells return value, the new cell offset is evaluated
        $next_cell_offset = Coordinate::stringfromColumnIndex($boundary["col"]).($boundary["row"] + $template_definition["skip_rows"] + 1);
    }

    $boundary = cloneCells($template, $worksheet, $template_definition["footer"]["range"], $next_cell_offset);

    //remove all template references from the rendered worksheet
    removeTemplates("template", $spreadsheet);


    // header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // header('Content-Disposition: attachment;filename="fake.xlsx"');
    // header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save($_REQUEST['json_fake_name'].'.xlsx');

    echo json_encode(['path' => 'builder/'.$_REQUEST['json_fake_name'].'.xlsx']);


    //function cloneCells, clone a range of cells from a given template at a defined location
    function cloneCells($templateRef, $masterRef, $range, $cell_offset, $mask_values = null){
        [$range_start, $range_end] = Coordinate::rangeBoundaries($range);
        [$sourceCell, ] = explode(":", $range);
        $cell_offset = difference($sourceCell, $cell_offset);

        $new_boundaries = [
            "col" => $range_start[0] + $cell_offset["col_offset"],
            "row" => 0,
            "offsets" => [
                "col" => $cell_offset["col_offset"],
                "row" => $cell_offset["row_offset"],
            ]
        ];

        for($col = $range_start[0]; $col <= $range_end[0]; $col++){
            for($row = $range_start[1]; $row <= $range_end[1]; $row++){
                $cell_coords = Coordinate::stringFromColumnIndex($col).$row;

                $cell_ref = $templateRef->getCell($cell_coords);
                $col_offset = $col + $cell_offset["col_offset"];
                $row_offset = $row + $cell_offset["row_offset"];

                //update cell boundaries
                $new_boundaries["row"] = $row_offset;

                //is the merged format applied on this cell?
                if($cell_ref->isMergeRangeValueCell()){
                    // remerge the respective cells, as its not included in the cellXfCollection?
                    [, $last_merge_cell] = Coordinate::rangeBoundaries($cell_ref->getMergeRange());
                    $masterRef->mergeCellsByColumnAndRow($col_offset, $row_offset, $last_merge_cell[0] +
                          $cell_offset["col_offset"], $last_merge_cell[1] + $cell_offset["row_offset"]);
                }

                //[FIX] The cell dimensions are normally included in the CellXfcollection, an anomaly in the code flow
                // is preventing the cell dimension to be added.
                $masterRef->getColumnDimension(Coordinate::stringFromColumnIndex($col_offset))
                    ->setWidth($templateRef->getColumnDimension(Coordinate::stringFromColumnIndex($col))->getWidth());

                //set the cellXf and cell value from the template to the master sheet (rendered spreadsheet)
                $masterRef->getCellByColumnAndRow($col_offset, $row_offset)
                    ->setValue($cell_ref->getValue())
                    ->setXfIndex($cell_ref->getXfIndex());

                //replace cell mask by dataset values
                if(!empty($mask_values))
                    replaceCellMask($masterRef->getCellByColumnAndRow($col_offset, $row_offset), $mask_values);
            }
        }

        return $new_boundaries;
    }

    //evaluate the distance between two given cell range, destination cell having the highest precedence
    function difference($sourceCell, $destinationCell){
        $cell_row_offset = preg_replace("/[A-Z]+/", "", $destinationCell) - preg_replace("/[A-Z]+/", "", $sourceCell);
        $cell_column_offset =
            Coordinate::columnIndexFromString(preg_replace("/\d+/", "", $destinationCell)) -
            Coordinate::columnIndexFromString(preg_replace("/\d+/", "", $sourceCell));

        return array("col_offset" => $cell_column_offset, "row_offset" => $cell_row_offset);
    }

    //replace values of specific cells having masks
    function replaceCellMask($cellRef, $mask_values){
        //find the mask
        preg_match_all("/[(]{2}[A-z]+[)]{2}/", $cellRef->getValue(), $patterns);

        //replace the mask, with a backslash, for the preg_replace
        $cell_value = $cellRef->getValue();
        replaceMask("/[(]{2}|[)]{2}/", $patterns, "/");

        //replace all mask, with thier respective values
        //[NOTE], the values are in order they appear in the mask array
        if(!empty($patterns[0])){
            //[NOTE] A delimiter "/" has been added in the patterns, it must be removed
            //to get the real key, its used to filter the mask_values array,
            //removing keys which are not present in the pattern
            $mask_values = removeElement($mask_values, removeMask("/[\/]{1}/", $patterns[0]));
            $formatted_str = preg_replace($patterns[0], $mask_values, $cell_value);
            $formatted_str = preg_replace("/[(]{2}|[)]{2}/", "", $formatted_str);
            $cellRef->setValue($formatted_str);
        }
    }

    //evaluate if given cell participates in a merge range
    function isCellInMergeRange($templateRef, $cell_name){
        $merged_cells = $templateRef->getMergeCells();

        foreach($merged_cells as $cell_range){
            [$range_start, $range_end] = explode(":", $cell_range);
            [$range_start, ] = Coordinate::rangeBoundaries($range_start);
            [$range_end, ] = Coordinate::rangeBoundaries($range_end);
            [$cell_name_start, ] = Coordinate::rangeBoundaries($cell_name);

            if($cell_name_start[0] >= $range_start[0] && $cell_name_start[0] <= $range_end[0]){
                if($cell_name_start[1] >= $range_start[1] && $cell_name_start[1] <= $range_end[1]){
                    return true;
                }
            }
        }
        return false;
    }

    //evaluate the distance between, first and last columns in a merged range
    function getCellDistance($cellRef){
        $cell_merge_range = $cellRef->getMergeRange();
        [$range_start, $range_end] = explode(":", $cell_merge_range);
        $range_start_column = Coordinate::columnIndexFromString(preg_replace("/\d+/", "", $range_start));
        $range_end_column = Coordinate::columnIndexFromString(preg_replace("/\d+/", "", $range_end));

        return abs($range_end_column - $range_start_column);
    }

    //extract the value from a specified masked string
    function replaceMask($mask, &$array, $delimiter){
        foreach($array as $key => $element){
            $array[$key] = preg_replace($mask, $delimiter, $element);
        }
    }

    //removes the unused keys in an associative array
    function removeElement($array, $exceptions){
        foreach($array as $key => $element){
            $array_keys = array_keys($array);
            if(!in_array($key, $exceptions)){
                array_splice($array, array_search($key, $array_keys) , 1);
            }
        }
        return $array;
    }

    //remove a specific mask from an array of strings
    function removeMask($mask, $array){
        foreach($array as $key => $element){
            $array[$key] = preg_replace($mask, "", $element);
        }
        return $array;
    }

    //removeTemplates, removes all template from which the structure was cloned
    function removeTemplates($worksheet_key, $spreadsheetRef){
        //find the templates
        $worksheet_names = $spreadsheetRef->getSheetNames();

        foreach ($worksheet_names as $name) {
            if(strpos($name, $worksheet_key) !== false){
                $sheet_index = $spreadsheetRef->getIndex($spreadsheetRef->getSheetByName($name));
                $spreadsheetRef->setActiveSheetIndex($sheet_index);
                $spreadsheetRef->removeSheetByIndex($sheet_index);
            }
        }
    }

    function getAggregationRange($left_most, $col_offset, $row_count){
        [$col, $row] = Coordinate::coordinateFromString($left_most);
        $right_most = Coordinate::stringFromColumnIndex(Coordinate::columnIndexFromString($col) + $col_offset);
        $min_row_name = $right_most.($row + 1);
        $max_row_name = $right_most.($row + $row_count);

        return ["min_row" => $min_row_name, "max_row_name" => $max_row_name];
    }

?>
