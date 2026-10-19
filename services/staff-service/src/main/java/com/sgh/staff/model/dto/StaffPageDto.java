package com.sgh.staff.model.dto;

import java.util.List;

public record StaffPageDto(
    List<StaffDto> content,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
